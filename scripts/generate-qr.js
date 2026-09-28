const fs=require('fs'),path=require('path'),QRCode=require('qrcode');
const root=path.join(__dirname,'..');
const creatures=JSON.parse(fs.readFileSync(path.join(root,'data','creatures.json'),'utf8'));
(async()=>{fs.mkdirSync(path.join(root,'public','qr'),{recursive:true});for(const c of creatures){await QRCode.toFile(path.join(root,'public','qr',`${c.id}.png`),c.qrPayload,{width:900,margin:3,errorCorrectionLevel:'H'});console.log(`QR создан: ${c.name}`)}})().catch(e=>{console.error(e);process.exit(1)});
