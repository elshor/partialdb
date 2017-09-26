const t = require('tap');
const config = require('./config');
const couchdb = require('../cached-couchdb');
const db = new couchdb(config);
var docid = null;
var other = null;
t.test('save new document and then retrieve it',(t)=>{
	t.plan(14);
	return db.store({title:'my object'}).then((doc)=>{
		t.ok(doc,'store returns object');
		t.ok(doc._id,'id field is created');
		t.ok(doc._rev,'rev field is created');
		docid = doc._id;
		return db.load(docid);
	}).then((ret)=>{
			t.equal(ret.title,'my object','load gets the correct object');
	}).then(()=>{
		let arr = [db.load(docid),db.load(docid)];
		return Promise.all(arr);
	}).then((arr1)=>{
		arr1[0].x = 11;
		arr1[0].y = 12;
		arr1[1].y = 121;
		arr1[1].z = 13;
		other = arr1[1];
		t.notEqual(arr1[0].x,arr1[1].x,'each load should return a clone of original object - not the same object');
		return db.store(arr1[0]);
	}).then((ret)=>{
		return db.load(docid);
	}).then((doc2)=>{
		t.equal(doc2.x,11,'document x was set correctly');
		t.equal(doc2.y,12,'document y was set correctly even though it was changed in second instance');
		return db.store(other);
	}).then((doc3)=>{
		t.equal(doc3.x,11,'after conflicting update x was not changed');
		t.equal(doc3.y,121,'after conflicting update y was changed');
		t.equal(doc3.z,13,'after conflicting update z was added');
		return db.load(docid);
	}).then((doc4)=>{
		t.equal(doc4.x,11,'after load x was not changed');
		t.equal(doc4.y,121,'after load y was changed');
		t.equal(doc4.z,13,'after load z was added');
	}).then(()=>{
		return db.delete(docid);
	}).then(()=>{
		return db.load(docid);
	}).then((doc5)=>{
		t.notOk(doc5,'after delete object should not exist');
	});
});


