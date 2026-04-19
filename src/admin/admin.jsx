import React, { useEffect } from "react";
import "./admin.css";
import { useLocation, useNavigate } from "react-router-dom";

function Admin({children}){
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add("admin-app");
    return () => {
      document.body.classList.remove("admin-app");
    };
  }, []);

 const raw = location.pathname;
 const cleaned = raw.endsWith("/") && raw !== "/" ? raw.slice(0, -1) : raw;
 const isRootAdmin = cleaned === "/admin";

      const redirectGameSession=()=>{
        let getGameId=JSON.parse(localStorage.getItem("userData"));
        getGameId=getGameId.gameId;
        console.log(JSON.parse(localStorage.getItem("userData")));
        window.location.href=process.env.REACT_APP_BASE_URL+"/active-games/"+getGameId;
      }

      return <div className="admin-background">
       <div className="header-admin">
        {/* {!isRootAdmin && (
          <div className="back-button-holder">
              <button
                className="back-button"
                onClick={() => navigate(-1)}
              >
              <i class="fa-solid fa-arrow-left"></i> Back
              </button>
          </div>
        )} */}

         <div class="brand-logo-and-game-holder">
          <div className="brand-logo-holder" onClick={()=>{window.location.href = process.env.REACT_APP_BASE_URL;}}>
          <img src="/admin/play.png" className="brand-logo"/>{localStorage.getItem("session") === "admin&admin" && " SUPERADMIN"}
         </div>
         <div>Split Canvas</div>
          
         </div>
       
         
         <div className="user">
            <img src="/admin/user.png"/>
         </div>
       </div>
       {children}
      </div>
}

export default Admin;
