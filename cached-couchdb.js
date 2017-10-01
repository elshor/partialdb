//cached couchdb
const axios = require('axios');
const MAX_NUMBER_OF_CACHE_DOCS = 10000;
const MAX_CONFLICT_RETRY = 20;
const INDEX_VIEW = '_design/indexes/_view/view';
const Cache = require("lru-cache");
const clone = require('clone');
const rfc6902 = require('rfc6902');
const patch = rfc6902.applyPatch;
const globalCache = {};
const Updater = require('./doc-updater');
const beforePatch = require('./triggers/before-patch');
const afterPatch = require('./triggers/after-patch');
const canPatch = require('./triggers/can-patch');
const canDelete = require('./triggers/can-delete');

module.exports = class CachedCouchdb{
	constructor(options){
		this.username = options.username;
		this.password = options.password;
		this.url = options.url;
		if(!globalCache[options.url]){
			initializeDB(options);
		}
		this.cache = globalCache[options.url].cache;
		this.revCache = globalCache[options.url].revCache;
	}

	load(id){
		if(!id){
			return Promise.resolve(undefined);
		}
		id = (typeof id === 'object')? id._id : id;
		let fromCache = this.cache.get(id);
		if(fromCache){
			return Promise.resolve(clone(fromCache,false));//false means it is not circular
		}
		return axios.get(encodeURIComponent(id),{
			baseURL : this.url,
			auth : {username:this.username, password:this.password}
		}).then((res)=>{
			this.cache.set(id,res.data);
			this.revCache.set(JSON.stringify(id) + JSON.stringify(res.data._rev),res.data);
			return clone(res.data,false);//false means it is not circular
		}).catch((err)=>{
			let code = err.response? err.response.status : 500;
			switch(code){
				case 404:
					return Promise.resolve(undefined);
			}
			return  errorHandler(err);
		});
	}
	loadRev(id,rev){
		let fromCache = this.revCache.get(JSON.stringify(id) + JSON.stringify(rev));
		if(fromCache){
			return Promise.resolve(fromCache);
		}
		return axios.get(encodeURIComponent(id),{
			params : rev? {rev:rev} : {},
			baseURL : this.url,
			auth : {username:this.username, password:this.password}
		}).then((res)=>{
			this.revCache.set(JSON.stringify(id) + JSON.stringify(res.data._rev),res.data);
			return res.data;
		}).catch(errorHandler);
	}
	
	store(doc,options){
		options = options || {};
		options._retries = options._retries || 0;
		if(options._retries > MAX_CONFLICT_RETRY){
			return Promise.reject({code:500,friendly:'There was an error storing the document',techie:'exceed max conflict retry'});
		}
		return this.load(doc._id||null).then((current)=>{
			//if cached _rev matches doc _rev or there is no doc _rev then we have current version
			if(!current || doc._rev ===current._rev || !doc._rev){
				let original = current || clone(doc);//if load returned a doc then it is the original
				let patches = diff(original,doc);//find diff from original (doc already contains the changes)
				doc._rev = current? current._rev : undefined;
				beforePatch(original,patches,options);
				let response = canPatch(original,patches,options);
				if(response){
					//can patch returned an error - reject promise with the error object
					return Promise.reject(response);
				}
				patch(original,patches);
				return axios.post('/',original,{
					baseURL : this.url,
					auth : {username:this.username, password:this.password},
					headers:{'Content-Type':'application/json'}}
				).then((res)=>{
					original._id = res.data.id;
					original._rev = res.data.rev;
					invalidate(this.url,res.data.id,res.data.rev);
					afterPatch(original,patches,options,this);
					return original;
				}).catch((err)=>{
					if(err && err.response && err.response.status === 409){
						return this.store(original,options);
					}else{
						return errorHandler(err);
					}
				});
			}else{
				//if the _rev of the doc to store conflics with the existing doc - patch changes
				return this.loadRev(doc._id,doc._rev)
				.then((original)=>{
					let differences = diff(original,doc);
					beforePatch(doc,differences,options);
					let response = canPatch(doc,differences,options);
					if(response){
						//can patch returned an error - reject promise with the error object
						return Promise.reject(response);
					}
					patch(current,differences);
					return this.store(current);
				}).catch(errorHandler);
			}
		}).catch(errorHandler);
	}
	
	delete(id,options){
		id = (typeof id === 'object')? id._id : id;
		return this.load(id).then((doc)=>{
			if(!doc){
				return Promise.reject({code:404,message:"The document was not found"});
			}
			let denial = canDelete(doc,options,this);
			if(denial){
				return Promise.reject(denial);
			}
			return axios.delete(encodeURIComponent(id),{
				baseURL : this.url,
				params : {rev:doc._rev},
				auth : {username:this.username, password:this.password},
				headers:{'Content-Type':'application/json'}}
			).then((res)=>{
				invalidate(this.url,id,res.data.rev);
			}).catch(errorHandler);
		});
	}
	getByIndex(indexName, key,options){
		let startKey = [indexName || 'all'];
		let endKey = [indexName || 'all'];
		if(Array.isArray(key)){
			startKey.push.apply(startKey,key);
			endKey.push.apply(endKey,key);
		}else if(key !== undefined){
			startKey.push(key);
			endKey.push(key);
		}
		endKey.push({});//the object be the last (assuming keys are text or numbers but not objects)
		return axios.get(INDEX_VIEW,{
			baseURL : this.url,
			auth : {username:this.username, password:this.password},
			params:{
				startkey:JSON.stringify(startKey),
				endkey:JSON.stringify(endKey)
			}
		}).then((res)=>{
			return Promise.all(res.data.rows.map((doc)=>this.load(doc.value,options)));
		}).catch(errorHandler);
	}
	patch(id,patches,options){
		if(!Array.isArray(patches)){
			patches = [patches];
		}
		return this.load(id,options).then((doc)=>{
			patch(doc,patches);
			return this.store(doc,options);
		});
	}
};

function invalidate(url,id,newRev){
	let fromCache = globalCache[url].cache.get(id);
	if(fromCache && fromCache._rev !== newRev){
		globalCache[url].cache.del(id);
	}
}

function initializeDB(options){
	globalCache[options.url] = {
		cache : Cache({max: MAX_NUMBER_OF_CACHE_DOCS}),
		revCache: Cache({max: MAX_NUMBER_OF_CACHE_DOCS}),
		updater: new Updater({
			url : options.url,
			username: options.username,
			password: options.password,
			invalidator : invalidate
		})
	};
}

function diff(from,to){
	return rfc6902.createPatch(from,to).filter((item)=>
		typeof item.value !== 'function' && item.path !== '/_rev');
}

function errorHandler(err){
	let code = err.response? err.response.status : (err.code ||500);
	let friendly = err.response? err.response.statusText : (err.friendly || 'An unknown error occured');
	let techie = err.response? err.response.body : (err.code? err.code : err);
	return  Promise.reject({code:code,techie:techie,friendly:friendly});
}
