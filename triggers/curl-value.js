//resolves an extended url string into a value. The extended curl syntax includes the option
//--path for the path from the curl response data to the required value
const curlParser = require('./parse-curl').parseCurlCommand;
const https = require('https'); 
const http = require('http');
const Handlebars = require('promised-handlebars')(require('handlebars'));

module.exports = processCURL;

function processTemplate(context,expression){
	let template = Handlebars.compile(expression);
	return template(context);
}

function processCURL(thisValue,expression){
	return processTemplate(thisValue,expression).then((curl)=>{
		let parsed = curlParser(curl);
		return sendHTTPRequest(parsed).then((res)=>res.data).catch((err)=>{
			let friendly = "Some error occured";
			let techie = err.response? `${err.response.status}: ${JSON.stringify(err.response.data)}`:JSON.stringify(err.message)||JSON.stringify(err);
			let code = err.response? err.response.status : 'UNKNOWN_ERROR';
			if(err.response){
				switch (err.response.status){
					case 401:
						friendly='You are not authorized to perform the action';
						break;
				}
			}
			switch(techie){
				case '"Network Error"':
					friendly = 'There was a network error - check if the server url is correct and accessable';
			}
			return Promise.reject({friendly:friendly,techie:techie,code:code});
		});
	});
}

function sendHTTPRequest(options){
	let parsed = require('url').parse(options.url);
	options.protocol = parsed.protocol;
	options.path = parsed.path;
	options.hostname = parsed.hostname;
	options.rejectUnauthorized=false;
	options.port = parsed.port;
	let resolver,rejector;
	let promise = new Promise((resolve,reject)=>{
		resolver=resolve;
		rejector=reject;
	});
	let resData = "";
	let engine = options.protocol === 'https:'? https : http;
	var req = engine.request(options, (res)=> { 
		res.on('data', (data)=>{ 
			resData += data.toString();
		});
		res.on('end',()=>{
			//check if there are any transformResponse elements
			if(options.transformResponse){
				if(!Array.isArray(options.transformResponse)){
					options.transformResponse = [options.transformResponse];
				}
				for(let i=0;i<options.transformResponse.length;++i){
					let temp = options.transformResponse[i](resData,res.headers);
					if(temp){
						resData = temp;
					}
				}
			}
			res.data = resData;
			
			//check if the request succeeded i.e. statusCode between 200 and 299
			if(res.statusCode >=200 && res.statusCode <300){
				resolver(res);
			}else{
				//this is an error code
				rejector({response:res,code:res.statusCode,message:res.statusMessage+': '+JSON.stringify(res.data),data:res.data});
			}
		});
	});
	req.on('error',(err)=>{
		rejector(err);
	});
	req.end();
	return promise;
}

