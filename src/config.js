// src/config.js
const config = {
  apiURL: process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com/api',
  //apiURL: process.env.REACT_APP_API_URL || 'https://backend-goby.onrender.com/api',
};

// Export nomeado
export const apiURL = config.apiURL;

// Export default
export default config;