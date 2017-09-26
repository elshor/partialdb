xyz = 

function (doc) {
  if(!doc.$meta || !Array.isArray(doc.$meta.indexes)){
    return;
  }
  for(var i=0;i<doc.$meta.indexes.length;++i){
    var index = doc.$meta.indexes[i];
    var key = [index.indexName || 'all'];
    key.push(index.key || '*');
    emit(key,doc._id);
  }
}

;