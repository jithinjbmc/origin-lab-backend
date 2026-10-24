require("dotenv").config();
const express=require("express");
const cors=require("cors");
const cookieParser=require("cookie-parser");

const contactRoute=require("./routes/contact");
const oauthRoute=require("./routes/oauth");
const analyticsRoute=require("./routes/analytics");

const app=express();

app.disable("x-powered-by");

const ALLOWED_ORIGINS=[
  process.env.ALLOWED_ORIGIN||"https://theoriginlab.in",
  "https://theoriginlab.in",
  "https://www.theoriginlab.in",
  "http://localhost:8000",
];

app.use(cors({
  origin:(origin,callback)=>{
    if(!origin||ALLOWED_ORIGINS.includes(origin))return callback(null,true);
    callback(new Error("Not allowed by CORS"));
  },
  credentials:true,
}));

app.use(express.json({limit:"16kb"}));
app.use(express.urlencoded({extended:false,limit:"16kb"}));
app.use(cookieParser());

app.get("/",(req,res)=>{res.send("ORIGIN Lab backend is running.");});

app.use("/api/contact",contactRoute);
app.use("/api/track",analyticsRoute);
app.use("/auth",oauthRoute);

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>{console.log("ORIGIN Lab backend listening on port "+PORT);});
