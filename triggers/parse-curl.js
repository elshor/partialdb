//parse curl commandline 
//copied from https://github.com/NickCarneiro/curlconverter/blob/master/util.js
const cookie = require('cookie');
const yargs = require('yargs');
const URL = require('url');
const querystring = require('querystring');
const https = require('https');
const jp = require('jsonpath');
/**
 * given this: [ 'msg1=value1', 'msg2=value2' ]
 * output this: 'msg1=value1&msg2=value2'
 * @param dataArguments
 */
const joinDataArguments = function (dataArguments) {
  var data = '';
  dataArguments.forEach(function (argument, i) {
    if (i === 0) {
      data += argument;
    } else {
      data += '&' + argument;
    }
  });
  return data;
};

/**
 * Parse a curl command. objects contains all the file objects that can be accessed using curl command. Objects in an object with key as file names and val as a file object containg data property with the content of the file base64 encoded
 * @param   {string}   curlCommand [[Description]]
 * @returns {[[Type]]} [[Description]]
 */
var parseCurlCommand = function (curlCommand,objects) {
  var newlineFound = /\r|\n/.exec(curlCommand);
  if (newlineFound) {
        // remove newlines
    curlCommand = curlCommand.replace(/\\\r|\\\n/g, '');
  }
  var yargObject = yargs(curlCommand.trim());
  var parsedArguments = yargObject.argv;
  var cookieString;
  var cookies;
  var url = parsedArguments._[1];
        // if url argument wasn't where we expected it, check other places
        // it shows up
  if (!url && parsedArguments['L']) {
    url = parsedArguments['L'];
  }
  if (!url && parsedArguments['compressed']) {
    url = parsedArguments['compressed'];
  }
  var headers;

  var parseHeaders = function (headerFieldName) {
    if (parsedArguments[headerFieldName]) {
      if (!headers) {
        headers = [];
      }
      if (!Array.isArray(parsedArguments[headerFieldName])) {
        parsedArguments[headerFieldName] = [parsedArguments[headerFieldName]];
      }
      parsedArguments[headerFieldName].forEach(function (header) {
        if (header.indexOf('Cookie') !== -1) {
          // stupid javascript tricks: closure
          cookieString = header;
        } else {
          var colonIndex = header.indexOf(':');
          var headerName = header.substring(0, colonIndex);
          var headerValue = header.substring(colonIndex + 1).trim();
          headers[headerName] = headerValue;
        }
      });
    }
  };

  parseHeaders('H');
  parseHeaders('header');

  if (parsedArguments.b) {
    cookieString = parsedArguments.b;
  }
  if (parsedArguments.cookie) {
    cookieString = parsedArguments.cookie;
  }
  var multipartUploads;
  if (parsedArguments.F) {
    multipartUploads = {};
    if (!Array.isArray(parsedArguments.F)) {
      parsedArguments.F = [parsedArguments.F];
    }
    parsedArguments.F.forEach(function (multipartArgument) {
            // input looks like key=value. value could be json or a file path prepended with an @
      var splitArguments = multipartArgument.split('=', 2);
      var key = splitArguments[0];
      var value = splitArguments[1];
      multipartUploads[key] = value;
    });
  }
  if (cookieString) {
    var cookieParseOptions = {
      decode: function (s) { return s; }
    };
    cookies = cookie.parse(cookieString.replace('Cookie: ', ''), cookieParseOptions);
  }
  var method;
  if (parsedArguments.X === 'POST') {
    method = 'post';
  } else if (parsedArguments.X === 'PUT') {
    method = 'put';
  } else if (parsedArguments.X === 'DELETE') {
    method = 'delete';
  } else if (parsedArguments.d || parsedArguments.data || parsedArguments['data-binary']) {
    method = 'post';
  } else {
    method = 'get';
  }

  var urlObject = URL.parse(url);
  var query = querystring.parse(urlObject.query, null, null, { maxKeys: 10000 });

  urlObject.search = null; // Clean out the search/query portion.
  var request = {
    url: url,
    urlWithoutQuery: URL.format(urlObject),
    method: method
  };

  if (Object.keys(query).length > 0) {
    request.query = query;
  }
  if (headers) {
    request.headers = headers;
  }
  if (cookies) {
    request.cookies = cookies;
  }
  if (multipartUploads) {
    request.multipartUploads = multipartUploads;
  }
  if (parsedArguments.data) {
    request.data = parsedArguments.data;
  } else if (parsedArguments['data-binary']) {
    request.data = parsedArguments['data-binary'];
    request.isDataBinary = true;
  } else if (parsedArguments['d']) {
    request.data = parsedArguments['d'];
  }

  if (parsedArguments['u']) {
    request.auth = parsedArguments['u'];
  }
  if (parsedArguments['user']) {
    request.auth = parsedArguments['user'];
  }
  if (Array.isArray(request.data)) {
    request.data = joinDataArguments(request.data);
  }

	if (parsedArguments['k'] || parsedArguments['insecure']) {
		request.insecure = true;
	}
	request.transformResponse = [contentTypeTransformer];
	
	//parse specialized type argument - the expected output type
	
	if (parsedArguments['path']) {
		//using jsonpath
		request.transformResponse.push(pathTransformer.bind(this,parsedArguments['path']));
	}
	if (parsedArguments['type']){
		//specified the output type of the response data. This will treat the response object
		//as this type. It will add the relevant $meta.qualifiedName
		let parsed = parsedArguments['type'].match(/^(.*)\/([^\/\:]*)\:(.*?)(\*?)$/);
    let qualifiedName = parsed[1]+ '/' + parsed[2] + ':' + parsed[3];
		if(parsed[4]){
			//the type is a list- add $meta property to each element in the array
			request.transformResponse.push(function(data,additional){
				if(!Array.isArray(data)){
					return Promise.reject('Expected an array but got a single object');
				}
				return data.map((elem)=>{
					elem.$meta = {
						class:'entity@dodido/user-entity',
						type:parsed[3],
						qualifiedName:qualifiedName,
						loaded : function(){return true;},
						created:new Date()
					};
					return elem;
				});
			});
		}else{
			//add $meta property to the data
			request.transformResponse.push(function(data){
				data.$meta = {
					class:'entity@dodido/user-entity',
					type:parsed[3],
					qualifiedName:qualifiedName,
					loaded : function(){return true;},
					created:new Date()
				};
				return data;
			});
		}
	}
	
	//agent arguments
	if(
		parsedArguments['cert']||
		parsedArguments['E']|| 
		parsedArguments['cacert'] ||
		parsedArguments['key']){
		request.cert = extractDataFromFile(objects[parsedArguments['cert']|| parsedArguments['E']]);
		request.cacert = extractDataFromFile(objects[parsedArguments['cacert']]);
		request.key = extractDataFromFile(objects[parsedArguments['key']]);
	}
	if(request.headers){
		request.headers = {};
		Object.assign(request.headers,headers);
		//transform to object type
	}
	return request;
};

function extractDataFromFile(file){
	if(!file || !file.data){
		return undefined;
	}
	return Buffer.from(file.data,'base64').toString();
}

var serializeCookies = function (cookieDict) {
  var cookieString = '';
  var i = 0;
  var cookieCount = Object.keys(cookieDict).length;
  for (var cookieName in cookieDict) {
    var cookieValue = cookieDict[cookieName];
    cookieString += cookieName + '=' + cookieValue;
    if (i < cookieCount - 1) {
      cookieString += '; ';
    }
    i++;
  }
  return cookieString;
};

function contentTypeTransformer(data,headers){
	if(headers['content-type']==='application/json'){
		return JSON.parse(data);
	}
}

function pathTransformer(path,data,headers){
	//this is the json path
	return jp.value(data,path);
}

module.exports = {
  parseCurlCommand: parseCurlCommand,
  serializeCookies: serializeCookies
};

