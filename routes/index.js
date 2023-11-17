var express = require('express');
var router = express.Router();
var users = require('../models/userModel')
var playlistModel = require('../models/playlistModel')
var passport = require('passport')
var localStrategy = require('passport-local').Strategy;
var multer = require('multer')
var id3 = require('node-id3')
var crypto = require('crypto')
const { Readable } = require('stream')
passport.use(new localStrategy(users.authenticate()))
const mongoose = require('mongoose');
const songModel = require('../models/songModel');
const userModel = require('../models/userModel');



mongoose.connect('mongodb://0.0.0.0/spt-n15').then(() => {
  console.log('connected to database')
}).catch(err => {
  console.log(err)
})

const conn = mongoose.connection

var gfsBucket, gfsBucketPoster
conn.once('open',()=>{
gfsBucket = new mongoose.mongo.GridFSBucket(conn.db,{
  bucketName:'audio'
})
gfsBucketPoster =  new mongoose.mongo.GridFSBucket(conn.db, {
   bucketName:'poster'
 })
})

/* GET home page. */
router.get('/',isloggedIn, async function (req, res, next) {
  const currentUser = await userModel.findOne({
    _id:req.user._id
  }).populate('playlist').populate({
    path:'playlist',
    populate : {
      path: 'songs',
      model: 'song'
    }
  })
  //  console.log(JSON.stringify(currentUser))
  res.render('home',{currentUser});
});

router.get('/poster/:posterName', (req, res, next) => {
  gfsBucketPoster.openDownloadStreamByName(req.params.posterName).pipe(res)
})

router.get('/register',(req,res,next)=>{
   res.render('signup')
})
router.get('/login',(req,res,next)=>{
  res.render('login')
})
/* user authentication routes */

router.post('/register', async (req, res, next) => {
  var newUser = {
    //user data here
    username: req.body.username,
    email: req.body.email
    //user data here
  };
  users
    .register(newUser, req.body.password)
    .then((result) => {
      passport.authenticate('local')(req, res, async () => {
        //destination after user register
        const songs = await songModel.find()
        const defaultPlaylist = await playlistModel.create({
          name: "default playlist",
          owner: req.user._id,
          songs: songs.map(song => song._id)
        })
 
        // console.log(songs.map(song => song._id))

       const newUser = await userModel.findOne({
         _id:req.user._id
       })
         

       newUser.playlist.push(defaultPlaylist._id)
        await newUser.save()  

        res.redirect('/');
      });
    })
    .catch((err) => {
      res.send(err);
    });
});


router.post('/login',passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/register',
}),(req, res, next) => {
  
});

router.get('/logout', (req, res, next) => {
  if (req.isAuthenticated())
  req.logout((err) => {
if (err) res.send(err);
else res.redirect('/login');
});
else {
  res.redirect('/');
}
});

function isloggedIn(req, res, next) 
{
  if (req.isAuthenticated()) 
  return next();
else 
res.redirect('/login');
}

function isAdmin(req,res,next){
  if(req.user.isAdmin) return next();
  else return res.redirect('/')
}

/* user authentication routes */

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

router.get('/uploadMusic',isloggedIn,isAdmin,(req,res,next)=>{
  //  console.log(req.user)
  res.render('uploadMusic')
})

router.get('/stream/:musicName', async(req,res,next)=>{
  
  const currentsong = await songModel.findOne({
    fileName:req.params.musicName
  })
  // console.log(currentsong)
  
  const stream = gfsBucket.openDownloadStreamByName(req.params.musicName)
  res.set('Content-Type','audio/mpeg')
  res.set('Content-Length',currentsong.size + 1)
  res.set('Content-Range',`bytes 0-${currentsong.size - 1}/${currentsong.size}`)
  res.set('Content-Ranges','bytes')
  res.status(206)
  
  stream.pipe(res)
  
})

router.get('/songName/:musicName',async function(req,res,next){
  const currentsong = await songModel.findOne({
    fileName:req.params.musicName
  })
  // console.log(currentsong)
  res.json({
    title:currentsong.title
  })
})

router.get('/like/:musicID',isloggedIn,async(req,res,next)=>{
  
  const currentUser = await userModel.findOne({
    _id:req.user._id
  })
  //  console.log(currentUser)
  const currentsong = await songModel.findOne({
    _id:req.params.musicID
  })
  //  console.log(currentsongID)
  if(currentUser.liked.indexOf(currentsong._id) === -1){
    currentUser.liked.push(currentsong._id)
    currentsong.likes.push(currentUser._id);
  }
  else{
    currentUser.liked.splice(currentUser.liked.indexOf(currentsong._id),1)
    currentsong.likes.splice(currentsong.likes.indexOf(currentUser._id),1)
  }
  await currentUser.save()  
  await currentsong.save()
  res.redirect('/');
  
})

router.get('/unlike/:musicID',isloggedIn,async function(req,res,next){
  const currentUser = await userModel.findOne({
    _id:req.user._id
  })
  //  console.log(currentUser)
  const currentsong = await songModel.findOne({
    _id:req.params.musicID
  })
  //  console.log(currentsongID)
  currentUser.liked.splice(currentUser.liked.indexOf(currentsong._id),1)
  currentsong.likes.splice(currentsong.likes.indexOf(currentUser._id),1)
  await currentUser.save()  
  await currentsong.save()
  res.redirect('/liked');
})

router.get('/liked',isloggedIn,async (req,res,next)=>{
  
  const LikesongUser = await userModel.findOne({
    _id:req.user._id
  }).populate('liked')
  
  console.log(LikesongUser)
  res.render('liked',{LikesongUser})
  
})

router.post('/createplaylist',isloggedIn, async function(req,res,next){
  
  const currentUser = await userModel.findOne({
    _id:req.user._id
  })
  
  const createplaylist = await playlistModel.create({
    name:req.body.playlist,
    owner:currentUser._id,
  })
  console.log(createplaylist)
  
  currentUser.playlist.push(createplaylist._id)
  
  await currentUser.save()
  
  res.redirect('/')
  
})

router.get('/playlist/:playlistID',isloggedIn,async function(req,res,next){
     const playlist = await playlistModel.findOne({
      _id:req.params.playlistID
     }).populate('songs')
   
 console.log(playlist)
   
  res.render('playlist',{playlist})
})

router.get('/playlist/:playlistID/:songID',async function(req,res,next){
  const playlist = await playlistModel.findOne({
   _id:req.params.playlistID
  })
console.log(playlist)
 
  const addsong = await songModel.findOne({
    _id:req.params.songID
  })
  console.log(addsong)

   if(playlist.songs.indexOf(addsong._id) === -1){
     playlist.songs.push(addsong._id)
   }
    else{
      playlist.songs.splice(playlist.songs.indexOf(addsong._id),1)
    }
    
  await playlist.save()

  res.redirect('/')

})

router.get('/removeplaylist/:playlistId/:songId',async function(req,res,next){
  const playlist = await playlistModel.findOne({
    _id:req.params.playlistId
  })
 
  playlist.songs.splice(playlist.songs.indexOf(req.params.songID),1)
    await playlist.save()

    res.redirect("back")

})

router.post('/uploadMusic',isloggedIn,isAdmin,upload.array('song'),async(req,res,next)=>{
 
  await Promise.all(req.files.map(async file =>{
  
    console.log(req.files)
    const randomName = crypto.randomBytes(20).toString('hex')
    const songData = id3.read(file.buffer)
    
  // console.log(id3.read(req.file.buffer))
  
  Readable.from(file.buffer).pipe(gfsBucket.openUploadStream(randomName))
  Readable.from(songData.image.imageBuffer).pipe(gfsBucketPoster.openUploadStream(randomName + 'poster'))
 
  await songModel.create({
    title:songData.title,
    artist:songData.artist,
    album:songData.album,
    size:file.size,
    poster:randomName + 'poster',
    fileName:randomName
  })
}))
  res.send('song uploaded')
})


router.get('/search',function(req,res,next){
  res.render('search')
})

router.post('/search',async(req,res,next)=>{
  console.log(req.body)
  const searhedMusic = await songModel.find({
    title: { $regex: req.body.search }
  })
  console.log(searhedMusic)
 
  res.json({
    songs: searhedMusic
  })
})

module.exports = router;
