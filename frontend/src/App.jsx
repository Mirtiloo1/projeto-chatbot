import "./App.css";
import { fetchData } from "./services/apiService";
import { useState, useEffect } from "react";

function App() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData()
      .then((data) => {
        setConversations(data);
      })
      .catch((error) => {
        console.error("Falha ao carregar conversas no componente:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <>
      <div>
        <h1 className="text-center text-3xl text-red-600 font-bold">
          Painel de Controle
        </h1>
      </div>

      <div className="text-center align-middle">
        {loading ? (
          <p>Carregando mensagens...</p>
        ) : (
          <div>
            <p>{conversations.length} conversas carregadas.</p>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
