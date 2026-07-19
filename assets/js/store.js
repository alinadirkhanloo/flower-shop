(function(){
  const KEY="flora-premium-store-v1";
  const defaults={cart:[],wishlist:[],compare:[],recent:[],user:null,orders:[],recipients:[],reminders:[],coupon:null,zone:"central"};
  const load=()=>{try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{return {...defaults}}};
  let state=load();
  const save=()=>{localStorage.setItem(KEY,JSON.stringify(state));window.dispatchEvent(new CustomEvent("fs:state",{detail:state}))};
  window.FS_STORE={
    get:()=>structuredClone(state),
    set:(patch)=>{state={...state,...patch};save()},
    addCart:(id,qty=1,options={})=>{const key=id+JSON.stringify(options);const found=state.cart.find(x=>x.key===key);found?found.qty+=qty:state.cart.push({key,id,qty,options});save()},
    updateCart:(key,qty)=>{const line=state.cart.find(x=>x.key===key);if(line)line.qty=Math.max(1,qty);save()},
    removeCart:key=>{state.cart=state.cart.filter(x=>x.key!==key);save()},
    toggle:(list,id)=>{state[list]=state[list].includes(id)?state[list].filter(x=>x!==id):[...state[list],id];save();return state[list].includes(id)},
    clearCart:()=>{state.cart=[];state.coupon=null;save()},
    reset:()=>{state={...defaults};save()}
  };
})();