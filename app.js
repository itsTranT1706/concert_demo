function myFunction(){
    window.location.href = "./gift.html";
  
    }
    //handle click open gift
    let click = document.querySelector("p1");
    click.addEventListener("click",myFunction);
    document.querySelector("#audio-player").pause();
    