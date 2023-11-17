var a = document.querySelector("#playlist")
a.addEventListener('click',function(dets){
    if(dets.target.id === "playlist"){
      document.querySelector("#popup").style.display ="flex";
    }
      
 })