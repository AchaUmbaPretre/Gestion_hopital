import React from 'react';
import './topBar.scss';
import { useNavigate } from 'react-router-dom';
import { BellOutlined,DashOutlined } from '@ant-design/icons';
import image from './../../assets/hopital.png';
import users from './../../assets/acha.jpeg'
const TopBar = () => {
  const navigate = useNavigate();
  return (
    <div className="topbar">
      <div className="topbar-left" onClick={() => navigate('/')}>
        <img src={image} alt="Logo" className="topbar-img" />
        <span className="logo">C.M Malandi</span>
      </div>
      <div className="topbar-right">
        <div className="topbar-icons">
          <BellOutlined />
        </div>
        <hr />
        <div className="topbar-user-rows">
          <img src={users} alt="" className='user-logo'/>
          <div className="topbar-name-rows">
            <span className="topbar-name">Acha ndambi</span>
            <span className="topbar-sous-name">Developpeur</span>
          </div>
        </div>
        <div className="topBar-trait">
          <DashOutlined className='topbar-icon' />
        </div>
      </div>
    </div>
  );
};

export default TopBar;
