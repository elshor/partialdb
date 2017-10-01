module.exports = function(original,patches,options,db){
	registerUserid(original,patches,options);
};

function registerUserid(original,patches,options,db){
	if(options && options.userid && (!original.$meta || !original.$meta.owner)){
		if(!original.$meta){
			patches.push({op:'add',path:'/$meta',value:{}});
		}
		patches.push({op:'add',path:'/$meta/owner',value:options.userid});
	}
}