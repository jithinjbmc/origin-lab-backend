// analytics.js — visitor tracking (in-memory store, survives restarts within a session)
const express=require("express");
const axios=require("axios");
const router=express.Router();

// In-memory visit log (resets on deploy/restart — acceptable for free tier)
// Max 5000 entries to stay within memory limits
const MAX_VISITS=5000;
const visits=[];

function parseUA(ua=""){
  const bot=/bot|crawler|spider|slurp|googlebot|bingbot|duckduckbot|facebookexternalhit|twitterbot/i.test(ua);
  const mob=/Mobile|Android|iPhone|iPad/i.test(ua);
  const device=bot?"Bot":mob?"Mobile":"Desktop";
  let browser="Other";
  if(/Edg\//i.test(ua))browser="Edge";
  else if(/OPR\//i.test(ua))browser="Opera";
  else if(/Chrome\//i.test(ua)&&!/Chromium/i.test(ua))browser="Chrome";
  else if(/Firefox\//i.test(ua))browser="Firefox";
  else if(/Safari\//i.test(ua))browser="Safari";
  let os="Other";
  if(/Windows/i.test(ua))os="Windows";
  else if(/Mac OS/i.test(ua))os="macOS";
  else if(/Linux/i.test(ua))os="Linux";
  else if(/Android/i.test(ua))os="Android";
  else if(/iOS|iPhone|iPad/i.test(ua))os="iOS";
  return{device,browser,os,is_bot:bot};
}

const geoCache=new Map();
async function geoLookup(ip){
  if(!ip||ip==="127.0.0.1"||ip.startsWith("::"))return{};
  if(geoCache.has(ip))return geoCache.get(ip);
  try{
    const r=await axios.get("http://ip-api.com/json/"+ip+"?fields=country,countryCode,regionName,city,isp,status",{timeout:3000});
    const d=r.data;
    if(d.status==="success"){
      const geo={country:d.country,country_code:d.countryCode,region:d.regionName,city:d.city,isp:d.isp};
      geoCache.set(ip,geo);
      if(geoCache.size>500)geoCache.delete(geoCache.keys().next().value);
      return geo;
    }
  }catch(_){}
  return{};
}

router.post("/",async(req,res)=>{
  res.status(204).end();
  const ip=((req.headers["x-forwarded-for"]||"").split(",")[0].trim()||req.socket.remoteAddress||"");
  const ua=(req.headers["user-agent"]||"").substring(0,500);
  const{page,referrer}=req.body||{};
  const{device,browser,os,is_bot}=parseUA(ua);
  const geo=await geoLookup(ip);
  const entry={
    id:visits.length+1,
    ts:new Date().toISOString(),
    page:page||"/",
    referrer:referrer||"",
    ip,
    country:geo.country||"",
    country_code:geo.country_code||"",
    city:geo.city||"",
    region:geo.region||"",
    isp:geo.isp||"",
    ua,device,browser,os,is_bot
  };
  visits.unshift(entry);
  if(visits.length>MAX_VISITS)visits.pop();
});

router.get("/data",(req,res)=>{
  const secret=req.headers["x-analytics-secret"]||req.query.secret||"";
  const expected=process.env.ANALYTICS_SECRET||"";
  if(!expected||secret!==expected)return res.status(401).json({error:"Unauthorised"});

  const limit=Math.min(parseInt(req.query.limit)||500,2000);
  const rows=visits.slice(0,limit);
  const total=visits.length;
  const human=visits.filter(v=>!v.is_bot);

  // Country summary
  const countryMap={};
  human.forEach(v=>{if(v.country){countryMap[v.country]=countryMap[v.country]||{country:v.country,country_code:v.country_code,visits:0};countryMap[v.country].visits++;}});
  const summary=Object.values(countryMap).sort((a,b)=>b.visits-a.visits).slice(0,20);

  // Page summary
  const pageMap={};
  human.forEach(v=>{pageMap[v.page]=(pageMap[v.page]||0)+1;});
  const pages=Object.entries(pageMap).map(([page,hits])=>({page,hits})).sort((a,b)=>b.hits-a.hits).slice(0,20);

  // Device/browser
  const devMap={};human.forEach(v=>{devMap[v.device]=(devMap[v.device]||0)+1;});
  const devices=Object.entries(devMap).map(([device,n])=>({device,n})).sort((a,b)=>b.n-a.n);
  const brMap={};human.forEach(v=>{brMap[v.browser]=(brMap[v.browser]||0)+1;});
  const browsers=Object.entries(brMap).map(([browser,n])=>({browser,n})).sort((a,b)=>b.n-a.n);

  // Daily
  const dayMap={};
  human.forEach(v=>{const d=v.ts.substring(0,10);dayMap[d]=(dayMap[d]||0)+1;});
  const daily=Object.entries(dayMap).map(([date,visits])=>({date,visits})).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30);

  res.json({total,rows,summary,pages,devices,browsers,daily});
});

module.exports=router;
