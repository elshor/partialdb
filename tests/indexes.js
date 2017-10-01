const t = require('tap');
const config = require('./config');
const couchdb = require('../cached-couchdb');
const db = new couchdb(config);

t.test('test indexes of documents using meta indexes',(t)=>{
	let indexGroups = [
		[{indexName:'a',key:1}],
		[{indexName:'a',key:1},{indexName:'b',key:2}],
		[{indexName:'a',key:2},{indexName:'b',key:2}],
		[{indexName:'a'},{indexName:'b',key:1}],
		[{indexName:'c',key:['a','b']}],
		[{indexName:'c',key:['a','c']}],
		[{indexName:'c',key:['b','c']}]
	];
	//first need to delete existing indexed documents
	return Promise.all([
		db.getByIndex('a').then((docs)=>Promise.all(docs.map((doc)=>db.delete(doc)))),
		db.getByIndex('c').then((docs)=>Promise.all(docs.map((doc)=>db.delete(doc))))
	]).then(()=>{
		return Promise.all(indexGroups.map((indx)=>{
			let doc = {$meta:{indexes:indx}};
			return db.store(doc);
		})).then(()=>{
			let results = [
				db.getByIndex('a'),
				db.getByIndex('a',1),
				db.getByIndex('a',4),
				db.getByIndex('a',2),
				db.getByIndex('b',2),
				db.getByIndex('b',1),
				db.getByIndex('c'),
				db.getByIndex('c','a'),
				db.getByIndex('c',['a']),
				db.getByIndex('c',['a','b']),
				db.getByIndex('c',['a','c'])
			];
			return Promise.all(results).then((lists)=>{
				t.equals(lists[0].length,4);
				t.equals(lists[1].length,2);
				t.equals(lists[2].length,0);
				t.equals(lists[3].length,1);
				t.equals(lists[4].length,2);
				t.equals(lists[5].length,1);
				t.equals(lists[6].length,3,'use indexName only');
				t.equals(lists[7].length,2,'use indexName with first key element not in array');
				t.equals(lists[8].length,2,'use indexName with first key element in array');
				t.equals(lists[9].length,1,'key is array [a,b]');
				t.equals(lists[10].length,1,'key is array [a,c]');
			});
	});
	});
});
