const t = require('tap');
const config = require('./config');
const couchdb = require('../cached-couchdb');
const db = new couchdb(config);
const delay = require('timeout-as-promise');
const http = require('http');
const PORT = 3334;

var server;

startServer(PORT);

t.test('curl triggers',(t)=>{
	let start = 'curl http://localhost:' + PORT + '/';
	let doc = {
		$meta:{
			triggers:[
				{action: start + 'first',onChange:'/y',target:'/z'},
				{action:start + 'second',onChange:'/y',target:'/a'},
				{action:start + 'second --path $.xyz',onChange:'/y',target:'/b'},
				{action:start + 'third -H "xyz: {{abc}}" -H "lmn: whatever"',onChange:'/y',target:'/c'}
			]
		}
	};
	return db.store(doc).then((doc)=>{
		doc.y = 1;
		return db.store(doc,{context:{abc:'great'}});
	}).then((doc)=>{
		return delay(1000).then(()=>db.load(doc._id)).then((doc)=>{
			t.equal(doc.z,'ok','Simple calling of a curl value');
			t.equal(doc.a.xyz,1,'curl received json object');
			t.equal(doc.b,1,'using json path argument');
			t.equal(doc.c,'great','using handlebars template in curl string');
		});
	}).catch((err)=>t.fail('There was an exception'))
	.then(()=>delay(3000)).then(()=>stopServer());
});

function stopServer(){
	server.unref();
}
function startServer(port){
	server = http.createServer((req, res) => {
		switch(req.url){
			case '/first':
				res.writeHead(200, { 'Content-Type': 'text/plain' });
				res.end('ok');
				break;
			case '/second':
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({xyz:1}));
				break;
			case '/third':
				if(req.headers.xyz){
					res.writeHead(200, { 'Content-Type': 'text/plain' });
					res.end(req.headers.xyz);
				}
				break;
			default:
				res.writeHead(400);
				res.end();
		}
	});
	server.listen(port);
}