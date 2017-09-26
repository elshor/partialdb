const curlValue = require('./curl-value');

module.exports = curlTrigger;

/**
 * Execute, if required, a curl based trigger. The action property in these triggers must start with 'curl '.
 * It's content is similar to curl command line with some additions
 * - type - TBD
 * - path - json path to the output value from the json input string
 * @param   {object}   doc     [[Description]]
 * @param   {[[Type]]} patches [[Description]]
 * @param   {object}   trigger [[Description]]
 * @param   {[[Type]]} options [[Description]]
 * @param   {[[Type]]} db      [[Description]]
 * @returns {[[Type]]} [[Description]]
 */
function curlTrigger(doc,patches,trigger,options,db){
	if(!trigger.onChange){
		log('error','trigger without onChange - ' + JSON.stringify(trigger));
	}
	for(let i=0;i<patches.length;++i){
		if(patches[i].path.startsWith(trigger.onChange)){
			return setValue(db,doc._id,trigger.action,trigger.target,options);
		}
	}
}

function setValue(db,id,action,target,options){
	return curlValue((options && options.context)?options.context : {},action)
	.then((val)=>{
		return db.patch(id,{op:'add',path:target,value:val},options);
	});
}

function log(type,message){
	console.info('[' + type.toUpperCase() + ']',message);
}