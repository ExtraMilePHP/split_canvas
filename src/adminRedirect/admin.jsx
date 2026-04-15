import react, { useEffect, useState } from "react"

function AdminRedirect(){
    const [themeData, setThemeData] = useState(null);
    const [userData, setUserData] = useState(null);

    useEffect(()=>{
        const storedSession = sessionStorage.getItem('userData');
        const themeData = sessionStorage.getItem('themeData');
        if(storedSession && themeData){
            console.log("setting up");
            setThemeData(JSON.parse(themeData));
            setUserData(JSON.parse(storedSession));
            console.log("sessioin state updated!");
        }
      },[]);

     useEffect(()=>{
        if(userData!=null){
            console.log("redirecting..");
            window.location.href =process.env.REACT_APP_ADMIN_REDIRECT+'?sessionId='+userData.sessionId+"&userId="+userData.userId+"&organizationId="+userData.organizationId;
        }
      },[userData]);

    return (
        <>

        </>
    )
}

export default AdminRedirect;