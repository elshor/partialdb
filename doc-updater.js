//invalidate database cache - used by cached-couchdb
var retryAfterFailInMs = 3600000;

module.exports = class Listener{
	constructor(options){
		this.url = options.url;
		this.username = options.username || 'admin';
		this.password = options.password || undefined;
		this.last = 'now';
		this.retry = options.retry || retryAfterFailInMs;
		this.invalidator = options.invalidator || function(){};
	}
	handleError(err){
		console.error(Date(),"Error in invalidate couchdb cache",err);
		console.trace();
		//rerun check DB after pausing for 10 seconds
		setTimeout(this.checkDB.bind(this),this.retry);
	}
	checkDB(){
		axios.get(this.url + '/_changes?feed=longpoll&since=' + this.last,{
			auth:{username:this.username,password:this.password}
		}).then((res)=>{
			let data = res.data;
			//next listener
			setTimeout(this.checkDB.bind(this),this.retry);
			if(data.last_seq){
				this.last = data.last_seq;
			}
			if(data.results){
				data.results.forEach((doc)=>this.invalidator(this.url,doc.id,doc.rev));
			}
		}).catch((err)=>{
			this.handleError(err);
		});
	}
};
