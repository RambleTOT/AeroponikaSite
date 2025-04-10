import React from 'react';
import { GiFlowerPot } from 'react-icons/gi';
import './Header.css';

const Header = () => {
  return (
    <header className="header">
      <div className="header-content">
        <GiFlowerPot className="header-icon" />
        <h1>Все про растения</h1>
      </div>
    </header>
  );
};

export default Header;