import React from 'react';
import './App.css';
import Header from './components/Header/Header';
import Article from './components/Article/Article';
import DeepSeekForm from './components/DeepSeekForm/DeepSeekForm';

function App() {
  return (
    <div className="App">
      <Header />
      <main>
        <Article />
      </main>
    </div>
  );
}

export default App;