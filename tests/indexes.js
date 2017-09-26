const t = require('tap');
const config = require('./config');
const couchdb = require('../cached-couchdb');
const db = new couchdb(config);

t.test('test indexes of documents using meta indexes',(t)=>{
	let indexGroups = [
		[{indexName:'a',key:1}],
		[{indexName:'a',key:1},{indexName:'b',key:2}],
		[{indexName:'a',key:2},{indexName:'b',key:2}],
		[{indexName:'a'},{indexName:'b',key:1}]
	];
	//first need to delete existing indexed documents
	return db.getByIndex('a').then((docs)=>Promise.all(docs.map((doc)=>db.delete(doc))))
	.then(()=>{
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
				db.getByIndex('b',1)
			];
			return Promise.all(results).then((lists)=>{
				t.equals(lists[0].length,4);
				t.equals(lists[1].length,2);
				t.equals(lists[2].length,0);
				t.equals(lists[3].length,1);
				t.equals(lists[4].length,2);
				t.equals(lists[5].length,1);
			});
	});
	});
});
