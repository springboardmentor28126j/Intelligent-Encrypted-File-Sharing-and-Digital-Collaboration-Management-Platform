import API from './api';

export const sendRegisterOtp = async (email) => {
  const response = await API.post('/auth/send-register-otp', { email });
  return response.data;
};

export const verifyAndRegister = async (registrationData) => {
  const response = await API.post('/auth/verify-and-register', registrationData);
  return response.data;
};

export const loginUser = async (credentials) => {
  const response = await API.post('/auth/login', credentials);
  if (response.data.access_token) {
    localStorage.setItem('token', response.data.access_token);
  }
  return response.data;
};

export const sendOtp = async (email) => {
  const response = await API.post('/auth/send-otp', { email });
  return response.data;
};

export const resetPasswordWithOtp = async (email, otp, new_password) => {
  const response = await API.post('/auth/reset-password-otp', { email, otp, new_password });
  return response.data;
};

export const logoutUser = () => {
  localStorage.removeItem('token');
};