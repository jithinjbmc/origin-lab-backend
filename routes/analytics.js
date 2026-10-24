const express=require("express");
const Database=require("better-sqlite3");
const path=require("path");
const axios=require("axios");
const router=express.Router();

const DB_PATH=process.env.ANALYTICS_DB||path.join("/tmp","analytics.db");
let db;
try{
  db=new Database(DB_PATH);
  db.exec(`CREATE TABLE IF NOT EXISTS visits(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,page TEXT,referrer TEXT,ip TEXT,
    country TEXT,country_code TEXT,city TEXT,region TEXT,isp TEXT,
    ua TEXT,device TEXT,browser TEXT,os TEXT,is_bot INTEGER DEFAULT 0)`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_ts ON visits(ts)");
}catch(e){console.error("Analytics DB:",e.message);}

function parseUA(ua=""){
  const bot=/bot|crawler|spider|slurp|googlebot|bingbot|duckduckbot/i.test(ua);
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
  return{device,browser,os,is_bot:bot?1:0};
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
  if(!db)return res.status(503).json({error:"Analytics unavailable"});
  res.status(204).end();
  const ip=((req.headers["x-forwarded-for"]||"").split(",")[0].trim()||req.socket.remoteAddress||"");
  const ua=(req.headers["user-agent"]||"").substring(0,500);
  const{page,referrer}=req.body||{};
  const{device,browser,os,is_bot}=parseUA(ua);
  const geo=await geoLookup(ip);
  const ts=new Date().toISOString();
  try{
    db.prepare("INSERT INTO visits(ts,page,referrer,ip,country,country_code,city,region,isp,ua,device,browser,os,is_bot)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(ts,page||"/",referrer||"",ip,geo.country||"",geo.country_code||"",geo.city||"",geo.region||"",geo.isp||"",ua,device,browser,os,is_bot);
  }catch(e){console.error("Analytics insert:",e.message);}
});

router.get("/data",(req,res)=>{
  if(!db)return res.status(503).json({error:"Analytics unavailable"});
  const secret=req.headers["x-analytics-secret"]||req.query.secret||"";
  const expected=process.env.ANALYTICS_SECRET||"";
  if(!expected||secret!==expected)return res.status(401).json({error:"Unauthorised"});
  const limit=Math.min(parseInt(req.query.limit)||500,2000);
  const offset=parseInt(req.query.offset)||0;
  const rows=db.prepare("SELECT * FROM visits ORDER BY ts DESC LIMIT ? OFFSET ?").all(limit,offset);
  const total=db.prepare("SELECT COUNT(*) as n FROM visits").get().n;
  const summary=db.prepare("SELECT country,country_code,COUNT(*) as visits FROM visits WHERE is_bot=0 AND country!='' GROUP BY country ORDER BY visits DESC LIMIT 20").all();
  const pages=db.prepare("SELECT page,COUNT(*) as hits FROM visits WHERE is_bot=0 GROUP BY page ORDER BY hits DESC LIMIT 20").all();
  const devices=db.prepare("SELECT device,COUNT(*) as n FROM visits WHERE is_bot=0 GROUP BY device ORDER BY n DESC").all();
  const browsers=db.prepare("SELECT browser,COUNT(*) as n FROM visits WHERE is_bot=0 GROUP BY browser ORDER BY n DESC").all();
  const daily=db.prepare("SELECT substr(ts,1,10) as date,COUNT(*) as visits FROM visits WHERE is_bot=0 GROUP BY date ORDER BY date DESC LIMIT 30").all();
  res.json({total,rows,summary,pages,devices,browsers,daily});
});

module.exports=router;
