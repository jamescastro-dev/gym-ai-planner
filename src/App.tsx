import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import Home from "@/pages/Home";
import Onboarding from "@/pages/Onboarding";
import Profile from "@/pages/Profile";
import Auth from "@/pages/Auth";
import Account from "@/pages/Account";
import Navbar from "@/components/layout/Navbar";
import { NeonAuthUIProvider } from "@neondatabase/neon-js/auth/react";
import { authClient } from "@/lib/auth";
import AuthProvider from "@/context/AuthContext";
import Footer from "@/components/layout/Footer";

function AppInner() {
  const navigate = useNavigate();

  return (
    <NeonAuthUIProvider
      authClient={authClient}
      defaultTheme="dark"
      navigate={navigate}
    >
      <AuthProvider>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route index element={<Home />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/auth/:pathname" element={<Auth />} />
              <Route path="/account/:pathname" element={<Account />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </NeonAuthUIProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}

export default App;