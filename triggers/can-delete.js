//check if user can delete the document
module.exports = function(doc,options,db){
	if(doc.$meta && doc.$meta.owner){
		if(!options || !options.userid || options.userid !== doc.$meta.owner){
			return {
				code:401,
				friendly:'User does not have permission to delete the document',
				techie:`Owner is '${original.$meta.owner}' and current userid is '${options&&options.userid?options.userid : 'unknown'}'.`
			};
		}
	}
};