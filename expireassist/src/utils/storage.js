export function loadInventory(){
  try{
    const raw = localStorage.getItem('expireassist.inventory');
    if(!raw) return sample();
    return JSON.parse(raw);
  }catch(e){
    return [];
  }
}

export function saveInventory(items){
  try{ localStorage.setItem('expireassist.inventory', JSON.stringify(items)); }catch(e){}
}

function sample(){
  const today = new Date();
  const soon = new Date(); soon.setDate(today.getDate()+2);
  const later = new Date(); later.setDate(today.getDate()+12);
  return [
    { id: 's1', name: 'Onions', expiry: soon.toISOString().slice(0,10) },
    { id: 's2', name: 'Milk', expiry: later.toISOString().slice(0,10) },
    { id: 's3', name: 'Garlic', expiry: later.toISOString().slice(0,10) },
  ];
}
