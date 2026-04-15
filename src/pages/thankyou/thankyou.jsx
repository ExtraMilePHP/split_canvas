// rules.jsx
import React, { useEffect, useState } from 'react';
import './thankyou.css';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { selectAdminToken } from "../../admin/sessionSlice";
import { fetchReport } from '../../functions/fetchReport';
import { setBackButtonUrl } from '../uiSlice';


function ThankYou(){
  const dispatch=useDispatch();
  const { user } = useSelector((state) => state.auth);
  const adminToken = useSelector(selectAdminToken);
  const { data: themeData } = useSelector((state) => state.theme);
  const [points,setPoints] = useState(0);
  const [time,setTime] =useState(0);


      useEffect(() => {
        dispatch(setBackButtonUrl(user.backButtonRedirect));
      }, [user]);
  
  console.log(user,themeData);
   // Fetch questions
    useEffect(() => {
      console.log("check---",user,themeData)
      if (!user || !themeData) return;
      fetchReport({
        userId: user.userId,
        token: adminToken,
      })
        .then((data) => {
          setPoints(data.report.points)
          let processTimeData=data.report.time.substring(3);
          setTime(processTimeData);
          console.log(data);
        })
        .catch(console.error);
    }, [user, adminToken,themeData]);
  return (
    <>
      <div className="thank-you-container">
        <img src="/thankyou.gif" className='thank-you-gif'/>
        <div className='thank-you-text'>{themeData?.custom_text_thank_you_page} </div>
        <div className='thank-you-text'>Your score is {points} out of {(themeData?.correctPoints*themeData?.noOfQuestion)} in {time} minutes.</div>
      </div>
    </>
  );
}

export default ThankYou;
