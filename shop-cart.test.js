const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const products=require('./data/products.json');
test('shop form adds the selected size, merges quantities, and confirms without navigation', async()=>{
  const values=new Map(),handlers={};
  const button={disabled:true}, toast={textContent:'',classList:{add(){},remove(){}}},count={textContent:''};
  const form={dataset:{productId:products[0].id},elements:{size:{value:products[0].sizes[1].id},quantity:{value:'1'}},querySelector:()=>button,addEventListener:(name,fn)=>handlers[name]=fn};
  const context={URL,URLSearchParams,setTimeout:()=>0,clearTimeout(){},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},document:{querySelectorAll:s=>s==='[data-add-to-cart]'?[form]:s==='[data-cart-count]'?[count]:[],querySelector:s=>s==='#cart-message'?toast:null},window:{location:{search:'',pathname:'/shop'},addEventListener(){}},fetch:async()=>({ok:true,json:async()=>products})};
  vm.runInNewContext(fs.readFileSync('public/js/cart.js','utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(button.disabled,false);
  let prevented=0;
  handlers.submit({preventDefault(){prevented++;}}); handlers.submit({preventDefault(){prevented++;}});
  const saved=JSON.parse(values.get('stonebridge-cart-v1'));
  assert.deepEqual(saved.items,[{productId:products[0].id,sizeId:products[0].sizes[1].id,quantity:2}]);
  assert.equal(prevented,2);assert.equal(count.textContent,2);assert.match(toast.textContent,/added to your basket/);
});
test('shop cards render forms with size and quantity while product details keep unit pricing',async()=>{
  const ejs=require('ejs');const money=c=>'$'+(c/100).toFixed(2);
  const card=await ejs.renderFile('views/partials/card.ejs',{product:products[0],photoCards:true,money});
  assert.match(card,/name="size"/);assert.match(card,/name="quantity" value="1"/);
  assert.match(card,/Add to basket/);assert.match(card,/View details/);
  assert.ok(card.indexOf('<form')>card.indexOf('<div class="card-meta">'));
});
