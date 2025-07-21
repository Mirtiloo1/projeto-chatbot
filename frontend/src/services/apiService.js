import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

axios.defaults.headers.common["x-api-key"] = API_KEY;

export async function fetchData() {
  try {
    const response = await axios.get(`${API_URL}/conversations`);
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.log("Erro ao buscar dados:", error);
    throw error;
  }
}

async function sendData(data) {
  try {
    const response = await axios.post(`${API_URL}/conversations`, data);
    console.log(response.data);
  } catch (error) {
    console.log("Erro ao buscar dados:", error);
  }
}
sendData();
fetchData();
