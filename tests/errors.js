const t = require('tap');
const couchdb = require('../cached-couchdb');
const config = require('./config');

t.test('test errors',(t)=>{
	t.plan(3);
	let options = {};
	Object.assign(options,config);
	options.url = 'http://localhost:5984/xyxz';
	var db = new couchdb(options);
	return db.store({x:'dummy'})
	.then(()=>t.fail('store with wrong url should fail'))
	.catch((err)=>{
		t.ok(err.code,'store to wrong url');
		return true;
	}).then(()=>{
		return db.load('ddd');
	}).then((x)=>t.notOk(x,'load with wrong url may return undefined'))
	.catch((err)=>{
		t.ok(err.code,'load to wrong url');
		return true;
	}).then(()=>{
		options.url = 'funny url';
		db = new couchdb(options);
		return db.load('ddd');
	}).then(()=>t.fail('load with funny url should fail'))
	.catch((err)=>t.ok(err.code,'load malformed url'));
});
