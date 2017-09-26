module.exports = function(original,patches,options){
	if(!original.$meta || !original.$meta.owner){
		//this document is not guarded
		return;
	}
	if(options && options.userid && options.userid === original.$meta.owner){
		return;
	}
	if(!Array.isArray(original.$meta.acl)){
		//no acl list - no permission to update the document
		return {code:401,friendly:'User does not have permission to update the document'};
	}
	//iterate over acl list and search for possible allow
	let acl = original.$meta.acl;
	for(let i=0;i<patches.length;++i){
		if(!testPath(options.userid,patches[i].path,acl)){
			//one failed patch is enough to disqualify everything
			return {
				code: 401,
				friendly:'User does not have permission to update the document',
				techie: patches[i]
			};
		}
	}
};

function testPath(userid,path,acl){
	for(let i=0;i<acl.length;++i){
		if(acl[i].user === userid && path.startsWith(acl[i].path)){
			return true;
		}
	}
	return false;
}