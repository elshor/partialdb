//activate after patching of a document. this function calls the various triggers
const curlTrigger = require('./curl-trigger');

module.exports = function(doc,patches,options,db){
	if(!doc || !doc.$meta || !Array.isArray(doc.$meta.triggers)){
		return;
	}
	return Promise.all(doc.$meta.triggers.map((trigger)=>mapTrigger(doc,patches,trigger,options,db)));
};

function mapTrigger(doc,patches,trigger,options,db){
	if(typeof trigger === 'object' && trigger.action && trigger.action.startsWith('curl')){
		return curlTrigger(doc,patches,trigger,options,db);
	}
}

