import React from 'react';
import Header from '../components/Header';

// TODO: Add authentication check before rendering
export default function Home() {
  return (
    <div>
      <Header title="Home" />
      <main>Welcome to the sample app</main>
    </div>
  );
}
