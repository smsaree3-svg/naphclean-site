/* NaphClean data layer: one API for the store, checkout and admin.
   Live mode talks to Supabase (config.js sets the project URL and public key).
   Without that config it runs in demo mode with sample data, so pages still work in previews. */
(function(){
  "use strict";
  var cfg = window.NC_CONFIG || {};
  var live = !!(cfg.supabaseUrl && cfg.supabaseKey && window.supabase && window.supabase.createClient);
  var sb = live ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: true, storageKey: "nc-admin-auth" } }) : null;

  var BULLETS_W = ["Protects clothes from moths, silverfish and fabric-damaging insects.","Helps prevent mildew and musty smells in closed spaces.","Non-staining on clothes, linen and delicate fabric when kept in a pouch.","Airtight, resealable zip pouch keeps unused balls at full strength."];
  var BULLETS_M = ["Protects clothes from moths, silverfish and fabric-damaging insects.","Helps prevent mildew and musty smells in closed spaces.","Colourful mix for drawers and washrooms. Keep off fabric to avoid colour transfer.","Airtight, resealable zip pouch keeps unused balls at full strength."];
  var FITS = {50:"One drawer, a suitcase or a shoe rack",100:"A standard cupboard or a bathroom corner",200:"A full wardrobe or a storage trunk",400:"A bedroom wardrobe plus seasonal storage"};
  function seedProducts(){
    var out=[], sort=10;
    [["white","w","Classic White",{50:[40,49],100:[74,89],200:[109,129],400:[179,209]},"NC-{g}G-1",BULLETS_W],
     ["multi","m","Multicolour",{50:[49,59],100:[99,119],200:[149,179],400:[199,239]},"NC-{g}G-MC-1",BULLETS_M]].forEach(function(c){
      [50,100,200,400].forEach(function(g){
        out.push({id:c[0]+"-"+g, title:"NaphClean "+c[2]+" Naphthalene Balls, "+g+"g", collection:c[2], family:"naphthalene", size_label:g+"g", size_g:g,
          price:c[3][g][0], mrp:c[3][g][1], sku:c[4].replace("{g}",g), stock:null, active:true, badge:g===200?"Popular":(g===400?"Best value":null),
          best_for:FITS[g], bullets:c[5].slice(), images:["images/"+c[1]+g+".webp","images/"+c[1]+g+"b.webp","images/hero2.webp","images/life1.webp","images/wardrobe.webp"], sort:sort});
        sort+=10;
      });
    });
    return out;
  }
  var SEED_SETTINGS = {store_name:"NaphClean", whatsapp:"916289479696", support_email:"care@naphclean.com", upi_id:null, upi_name:"NaphClean",
    delivery_min:3, delivery_max:6, shipping_fee:0, free_shipping_over:0, pay_upi:true, pay_razorpay:false, pay_whatsapp:true, razorpay_key_id:null,
    announcement:"Free delivery across India"};

  /* ---------- helpers ---------- */
  function inr(n){ return "₹" + Math.round(Number(n)||0).toLocaleString("en-IN"); }
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
  function ls(k,v){ try{ if(v===undefined) return localStorage.getItem(k); if(v===null) localStorage.removeItem(k); else localStorage.setItem(k,v); }catch(e){ return null; } }
  function clone(o){ return JSON.parse(JSON.stringify(o)); }
  function digits(s){ return String(s||"").replace(/\D/g,""); }
  function phone10(s){ return digits(s).slice(-10); }
  function img(path, base){ if(!path) return ""; if(/^(https?:|data:|blob:)/.test(path)) return path; return (base||"") + path.replace(/^\/+/,""); }
  function err(e){ if(!e) return "Something went wrong. Please try again."; var m=e.message||e.error_description||e.error||String(e); return m.replace(/^.*?ERROR:\s*/,""); }
  function orderNo(){ var h=""; for(var i=0;i<6;i++) h+="0123456789ABCDEF"[Math.floor(Math.random()*16)]; return "NC"+h; }
  var STATES=["Andaman and Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chandigarh","Chhattisgarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jammu and Kashmir","Jharkhand","Karnataka","Kerala","Ladakh","Lakshadweep","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Puducherry","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal"];

  /* ---------- demo backend (in memory, remembered in this browser) ---------- */
  var demo = null;
  function demoDB(){
    if(demo) return demo;
    var saved=null; try{ saved=JSON.parse(ls("nc_demo_db")||"null"); }catch(e){}
    if(saved && saved.v===1){ demo=saved; return demo; }
    var products=seedProducts(); products[7].stock=4; products[3].stock=12;
    var names=[["Priya Sharma","Kolkata","West Bengal","700029"],["Rahul Mehta","Ahmedabad","Gujarat","380015"],["Sneha Iyer","Chennai","Tamil Nadu","600020"],["Ankit Verma","Lucknow","Uttar Pradesh","226010"],["Farah Khan","Mumbai","Maharashtra","400050"],["Deepak Rao","Bengaluru","Karnataka","560034"],["Meera Nair","Kochi","Kerala","682020"],["Arjun Das","Guwahati","Assam","781005"]];
    var orders=[], now=Date.now();
    var plan=[[0,"new","upi","pending",[["white-400",1]]],[0,"new","whatsapp","pending",[["multi-100",2],["white-50",1]]],[1,"confirmed","upi","paid",[["white-200",2]]],[1,"packed","razorpay","paid",[["multi-400",1]]],
      [2,"shipped","upi","paid",[["white-100",3]]],[3,"delivered","whatsapp","paid",[["white-400",2]]],[4,"delivered","upi","paid",[["multi-200",1],["white-50",2]]],[5,"cancelled","upi","pending",[["white-50",1]]],
      [6,"delivered","razorpay","paid",[["white-200",1]]],[8,"delivered","upi","paid",[["multi-50",4]]],[9,"delivered","whatsapp","paid",[["white-400",1],["multi-400",1]]],[11,"delivered","upi","paid",[["white-100",2]]],[13,"delivered","upi","paid",[["white-200",3]]]];
    plan.forEach(function(p,i){
      var n=names[i%names.length], items=p[4].map(function(x){ var pr=products.filter(function(q){return q.id===x[0]})[0]; return {id:pr.id,title:pr.title,size:pr.size_label,sku:pr.sku,qty:x[1],price:pr.price,mrp:pr.mrp,image:pr.images[0]}; });
      var sub=items.reduce(function(a,b){return a+b.qty*b.price},0), t=new Date(now-p[0]*86400000-(i*37%600)*60000).toISOString();
      orders.push({id:"demo-"+i, order_no:orderNo(), created_at:t, updated_at:t, status:p[1], payment_method:p[2], payment_status:p[3], customer_name:n[0], phone:"98"+String(10000000+i*7919).slice(0,8), email:null,
        address1:(12+i)+" Park Lane", address2:null, city:n[1], state:n[2], pin:n[3], items:items, subtotal:sub, discount:0, discount_code:null, shipping:0, total:sub,
        customer_note:null, admin_note:null, courier:p[1]==="shipped"||p[1]==="delivered"?"Delhivery":null, tracking_no:p[1]==="shipped"||p[1]==="delivered"?"DL"+(8800000+i*113):null,
        upi_ref:p[2]==="upi"&&p[3]==="pending"&&i===0?"412345678901":null, razorpay_order_id:null, razorpay_payment_id:p[2]==="razorpay"?"pay_demo"+i:null});
    });
    demo={v:1, settings:Object.assign(clone(SEED_SETTINGS),{upi_id:"naphclean@okaxis"}), products:products, orders:orders,
      discounts:[{code:"WELCOME10",kind:"percent",value:10,min_order:100,max_uses:null,used_count:3,expires_at:null,active:true,created_at:new Date(now-20*86400000).toISOString()}],
      admins:[{email:"amit@lumisha.in",added_at:new Date(now-30*86400000).toISOString()}]};
    return demo;
  }
  function demoSave(){ ls("nc_demo_db", JSON.stringify(demo)); }
  function demoDiscount(code, sub){
    var d=demoDB().discounts.filter(function(x){return x.code===String(code||"").trim().toUpperCase()})[0];
    if(!d||!d.active) return {ok:false,message:"This code is not valid."};
    if(d.expires_at && new Date(d.expires_at)<new Date()) return {ok:false,message:"This code has expired."};
    if(d.max_uses!=null && d.used_count>=d.max_uses) return {ok:false,message:"This code has been fully used."};
    if(sub<d.min_order) return {ok:false,message:"Add ₹"+(d.min_order-sub)+" more to use this code."};
    var amt=d.kind==="percent"?Math.floor(sub*Math.min(d.value,100)/100):Math.min(d.value,sub);
    return {ok:true,code:d.code,discount:amt,message:d.kind==="percent"?d.value+"% off applied":"₹"+d.value+" off applied"};
  }

  /* ---------- store API ---------- */
  var CAT_KEY="nc_catalogue_v1";
  function cachedCatalogue(){
    try{ var c=JSON.parse(ls(CAT_KEY)||"null"); if(c && c.products && c.products.length && c.settings) return c; }catch(e){}
    if(!live){ var d=demoDB(); return {settings:clone(d.settings), products:clone(d.products.filter(function(p){return p.active}))}; }
    return {settings:clone(SEED_SETTINGS), products:seedProducts()};
  }
  function loadCatalogue(){
    if(!live){ return Promise.resolve(cachedCatalogue()); }
    return Promise.all([
      sb.from("settings").select("*").eq("id",1).maybeSingle(),
      sb.from("products").select("*").eq("active",true).order("sort",{ascending:true})
    ]).then(function(r){
      if(r[0].error) throw r[0].error; if(r[1].error) throw r[1].error;
      var c={settings:r[0].data||clone(SEED_SETTINGS), products:r[1].data||[]};
      ls(CAT_KEY, JSON.stringify(c)); return c;
    });
  }
  function checkDiscount(code, sub){
    if(!live) return Promise.resolve(demoDiscount(code, sub));
    return sb.rpc("check_discount",{p_code:code,p_subtotal:sub}).then(function(r){ if(r.error) throw r.error; return r.data; });
  }
  function placeOrder(p){
    if(live) return sb.rpc("place_order",{p:p}).then(function(r){ if(r.error) throw new Error(err(r.error)); return r.data; });
    var d=demoDB(), s=d.settings, sub=0, lines=[];
    try{
      if(p.payment_method==="upi" && !s.upi_id) throw new Error("UPI payment is not available right now.");
      if(phone10(p.phone).length<10) throw new Error("Enter a valid 10-digit mobile number.");
      (p.items||[]).forEach(function(it){ var pr=d.products.filter(function(x){return x.id===it.id && x.active})[0]; if(!pr) throw new Error("A product in your bag is no longer available. Please refresh.");
        if(pr.stock!=null && pr.stock<it.qty) throw new Error(pr.title+" has only "+pr.stock+" left.");
        sub+=pr.price*it.qty; lines.push({id:pr.id,title:pr.title,size:pr.size_label,sku:pr.sku,qty:it.qty,price:pr.price,mrp:pr.mrp,image:pr.images[0]}); });
      var disc=0, code=null; if(p.discount_code){ var dr=demoDiscount(p.discount_code,sub); if(!dr.ok) throw new Error(dr.message); disc=dr.discount; code=dr.code; }
      var ship=(s.shipping_fee>0 && (s.free_shipping_over===0 || sub-disc<s.free_shipping_over))?s.shipping_fee:0, tot=sub-disc+ship, no=orderNo(), t=new Date().toISOString();
      d.orders.unshift({id:"demo-"+no, order_no:no, created_at:t, updated_at:t, status:"new", payment_method:p.payment_method, payment_status:"pending", customer_name:p.name, phone:phone10(p.phone), email:p.email||null,
        address1:p.address1, address2:p.address2||null, city:p.city, state:p.state, pin:p.pin, items:lines, subtotal:sub, discount:disc, discount_code:code, shipping:ship, total:tot, customer_note:p.note||null,
        admin_note:null, courier:null, tracking_no:null, upi_ref:null, razorpay_order_id:null, razorpay_payment_id:null});
      lines.forEach(function(l){ var pr=d.products.filter(function(x){return x.id===l.id})[0]; if(pr.stock!=null) pr.stock-=l.qty; });
      if(code) d.discounts.forEach(function(x){ if(x.code===code) x.used_count++; });
      demoSave();
      return Promise.resolve({order_no:no,total:tot,subtotal:sub,discount:disc,shipping:ship,payment_method:p.payment_method,upi_id:p.payment_method==="upi"?s.upi_id:null,upi_name:s.upi_name,items:lines});
    }catch(e){ return Promise.reject(e); }
  }
  function orderStatus(no, phone){
    if(live) return sb.rpc("order_status",{p_order_no:no,p_phone:phone}).then(function(r){ if(r.error) throw r.error; return r.data; });
    var o=demoDB().orders.filter(function(x){return x.order_no===String(no||"").trim().toUpperCase() && x.phone===phone10(phone)})[0];
    return Promise.resolve(o?{order_no:o.order_no,created_at:o.created_at,status:o.status,payment_status:o.payment_status,payment_method:o.payment_method,items:o.items,total:o.total,courier:o.courier,tracking_no:o.tracking_no,city:o.city}:null);
  }
  function submitUpiRef(no, phone, ref){
    if(live) return sb.rpc("submit_upi_ref",{p_order_no:no,p_phone:phone,p_ref:ref}).then(function(r){ if(r.error) throw new Error(err(r.error)); return r.data; });
    if(!/^[A-Za-z0-9]{6,30}$/.test(ref||"")) return Promise.reject(new Error("Enter the 12-digit UPI reference (UTR) from your payment app."));
    var o=demoDB().orders.filter(function(x){return x.order_no===no})[0]; if(o){ o.upi_ref=ref; demoSave(); } return Promise.resolve(!!o);
  }
  function razorpay(action, body){
    if(!live) return Promise.reject(new Error("Online payment works on the live site only."));
    return fetch(cfg.supabaseUrl.replace(/\/$/,"")+"/functions/v1/razorpay", {method:"POST", headers:{"Content-Type":"application/json","apikey":cfg.supabaseKey,"Authorization":"Bearer "+cfg.supabaseKey}, body:JSON.stringify(Object.assign({action:action},body))})
      .then(function(r){ return r.json().then(function(j){ if(!r.ok||j.error) throw new Error(j.error||"Payment service is unavailable."); return j; }); });
  }

  /* ---------- admin API ---------- */
  function q(r){ if(r.error) throw new Error(err(r.error)); return r.data; }
  var admin = {
    session: function(){ if(!live) return Promise.resolve({user:{email:"demo@naphclean.com"}}); return sb.auth.getSession().then(function(r){ return r.data.session; }); },
    signIn: function(email, pw){ return sb.auth.signInWithPassword({email:email.trim(), password:pw}).then(function(r){ if(r.error) throw new Error(r.error.message==="Invalid login credentials"?"That email and password do not match.":r.error.message); return r.data.session; }); },
    signOut: function(){ return live ? sb.auth.signOut() : Promise.resolve(); },
    isAdmin: function(){ if(!live) return Promise.resolve(true); return sb.rpc("is_admin").then(q); },
    orders: function(){ if(!live) return Promise.resolve(clone(demoDB().orders)); return sb.from("orders").select("*").order("created_at",{ascending:false}).limit(2000).then(q); },
    updateOrder: function(id, patch){
      if(!live){ var o=demoDB().orders.filter(function(x){return x.id===id})[0]; Object.assign(o,patch,{updated_at:new Date().toISOString()}); demoSave(); return Promise.resolve(clone(o)); }
      return sb.from("orders").update(patch).eq("id",id).select().single().then(q);
    },
    products: function(){ if(!live) return Promise.resolve(clone(demoDB().products).sort(function(a,b){return a.sort-b.sort})); return sb.from("products").select("*").order("sort",{ascending:true}).then(q); },
    saveProduct: function(p, isNew){
      var row=clone(p); delete row.created_at; delete row.updated_at;
      if(!live){ var d=demoDB(), i=d.products.findIndex(function(x){return x.id===row.id});
        if(isNew && i>-1) return Promise.reject(new Error("A product with this ID already exists."));
        if(i>-1) d.products[i]=Object.assign(d.products[i],row); else d.products.push(Object.assign({created_at:new Date().toISOString()},row)); demoSave(); return Promise.resolve(row); }
      return (isNew ? sb.from("products").insert(row) : sb.from("products").update(row).eq("id",row.id)).select().single().then(q);
    },
    deleteProduct: function(id){ if(!live){ var d=demoDB(); d.products=d.products.filter(function(x){return x.id!==id}); demoSave(); return Promise.resolve(); } return sb.from("products").delete().eq("id",id).then(q); },
    adjustStock: function(id, delta){
      if(!live){ var p=demoDB().products.filter(function(x){return x.id===id})[0]; if(p && p.stock!=null){ p.stock+=delta; demoSave(); } return Promise.resolve(); }
      return sb.from("products").select("stock").eq("id",id).maybeSingle().then(function(r){ if(!r.data || r.data.stock==null) return; return sb.from("products").update({stock:Math.max(0,r.data.stock+delta)}).eq("id",id).then(q); });
    },
    uploadImage: function(file){
      if(!live) return new Promise(function(res){ var fr=new FileReader(); fr.onload=function(){ res(fr.result); }; fr.readAsDataURL(file); });
      var ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,""), path="p/"+Date.now()+"-"+Math.random().toString(36).slice(2,8)+"."+ext;
      return sb.storage.from("product-images").upload(path, file, {cacheControl:"31536000", upsert:false, contentType:file.type}).then(function(r){ if(r.error) throw new Error(err(r.error)); return sb.storage.from("product-images").getPublicUrl(path).data.publicUrl; });
    },
    discounts: function(){ if(!live) return Promise.resolve(clone(demoDB().discounts)); return sb.from("discount_codes").select("*").order("created_at",{ascending:false}).then(q); },
    saveDiscount: function(d, isNew){
      if(!live){ var db=demoDB(), i=db.discounts.findIndex(function(x){return x.code===d.code}); if(isNew&&i>-1) return Promise.reject(new Error("That code already exists."));
        if(i>-1) db.discounts[i]=Object.assign(db.discounts[i],d); else db.discounts.unshift(Object.assign({used_count:0,created_at:new Date().toISOString()},d)); demoSave(); return Promise.resolve(d); }
      var row=clone(d); delete row.created_at; delete row.used_count;
      return (isNew ? sb.from("discount_codes").insert(row) : sb.from("discount_codes").update(row).eq("code",row.code)).select().single().then(q);
    },
    deleteDiscount: function(code){ if(!live){ var d=demoDB(); d.discounts=d.discounts.filter(function(x){return x.code!==code}); demoSave(); return Promise.resolve(); } return sb.from("discount_codes").delete().eq("code",code).then(q); },
    settings: function(){ if(!live) return Promise.resolve(clone(demoDB().settings)); return sb.from("settings").select("*").eq("id",1).single().then(q); },
    saveSettings: function(s){ var row=clone(s); delete row.id; delete row.updated_at;
      if(!live){ Object.assign(demoDB().settings,row); demoSave(); return Promise.resolve(clone(demoDB().settings)); }
      return sb.from("settings").update(row).eq("id",1).select().single().then(q); },
    admins: function(){ if(!live) return Promise.resolve(clone(demoDB().admins)); return sb.from("admins").select("*").order("added_at").then(q); },
    addAdmin: function(email){ email=String(email||"").trim().toLowerCase(); if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Promise.reject(new Error("Enter a valid email address."));
      if(!live){ var d=demoDB(); if(!d.admins.some(function(a){return a.email===email})) d.admins.push({email:email,added_at:new Date().toISOString()}); demoSave(); return Promise.resolve(); }
      return sb.from("admins").insert({email:email}).then(q); },
    removeAdmin: function(email){ if(!live){ var d=demoDB(); d.admins=d.admins.filter(function(a){return a.email!==email}); demoSave(); return Promise.resolve(); } return sb.from("admins").delete().eq("email",email).then(q); },
    onNewOrder: function(cb){ if(!live) return function(){}; var ch=sb.channel("orders-feed").on("postgres_changes",{event:"INSERT",schema:"public",table:"orders"},function(p){ cb(p.new); }).subscribe(); return function(){ sb.removeChannel(ch); }; },
    resetDemo: function(){ ls("nc_demo_db",null); demo=null; }
  };

  window.NC = { live:live, mode:live?"live":"demo", cfg:cfg, sb:sb, inr:inr, esc:esc, ls:ls, img:img, err:err, phone10:phone10, STATES:STATES,
    seedProducts:seedProducts, cachedCatalogue:cachedCatalogue, loadCatalogue:loadCatalogue, checkDiscount:checkDiscount, placeOrder:placeOrder,
    orderStatus:orderStatus, submitUpiRef:submitUpiRef, razorpay:razorpay, admin:admin };
})();
