const t = require('tap');
const config = require('./config');
const couchdb = require('../cached-couchdb');
const db = new couchdb(config);
var docid = null;
var thedoc = null;
t.test('test permissions',(t)=>{
	t.plan(13);
	return db.store({title:'just testing'},{userid:'dummy'})
	.then((doc)=>{
		docid = doc._id;
		thedoc = doc;
		t.equal(doc.$meta.owner,'dummy','after storing document, add owner meta');
	}).catch((err)=>{
		t.fail('adding owner meta failed');
		return true;
	}).then(()=>{
		thedoc.x = 1;
		return db.store(thedoc,{userid:'dummy'})
			.catch(()=>t.fail('store by dummy should succeed'))
			.then(()=>t.pass('store by dummy is ok'));
	}).then(()=>{
		thedoc.y = 2;
		return db.store(thedoc,{userid:'dummy2'})
			.then((doc)=>t.fail('dummy2 cannot change y before it is added to acl'))
			.catch(()=>t.pass('dummy2 cannot change y before it is added to acl'));
	}).then(()=>{
		thedoc.z = 3;
		return db.store(thedoc)
			.then(()=>t.fail('updating z by unspecified user should fail'))
			.catch(()=>t.pass('updating z by unspecified user should fail'));
	}).then(()=>{
		return db.load(docid)
		.catch(()=>t.fail('load doc should be ok'));
	}).then((doc)=>{
		t.pass('load doc was ok');
		t.equal(doc.x,1,"owner can patch");
		t.notOk(doc.y,"other user can not patch");
		t.notOk(doc.z,"if user is not specified then cannot patch");
		return doc;
	}).then((doc)=>{
		doc.$meta.acl = [{user:'dummy2',path:'/y'}];
		return db.store(doc,{userid:'dummy'});
	}).then((doc)=>{
		doc.y = 4;
		return db.store(doc,{userid:'dummy2'})
			.then((doc)=>{t.equal(doc.y,4,'After adding permission, dummy2 can modify y');return doc;})
			.catch(()=>t.fail('After adding permission, dummy2 should not fail updating y'));
	}).then((doc)=>{
		doc.y = 5;
		doc.z = 6;
		return db.store(doc,{userid:'dummy2'})
			.then(()=>t.fail('store from dummy2 changing z should fail'))
			.catch((err)=>t.equal(err.code,401,'several changes - dummy2 cannot change z - should fail'));
	}).then(()=>{
		return db.load(docid)
			.catch(()=>t.fail('Failed to load document'));
	}).then((doc)=>{
		doc.y = 7;
		return db.store(doc,{userid:'dummy3'})
			.then((doc)=>t.fail('store from user dummy3 should fail',doc))
			.catch((err)=>t.equal(err.code,401,'dummy3 cannot modify document'))
			.then(()=>doc);
	}).then((doc)=>{
		let docid = doc._id;
		return db.delete(doc,{userid:'dummy1'})
		.then(()=>t.fail('dummy1 should not be able to delete a document owned by dummy'))
		.catch(()=>t.pass('dummy1 should not be able to delete a document owned by dummy'))
		.then(()=>docid);
	}).then((docid)=>{
		return db.delete(docid,{userid:'dummy'})
		.then(()=>t.pass('dummy should  be able to delete its own document'))
		.catch((err)=>t.fail('dummy should  be able to delete its own document'));
	});
});
