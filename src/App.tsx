import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import Home from "@/pages/Home";
import Onboarding from "@/pages/Onboarding";
import Profile from "@/pages/Profile";
import Auth from "@/pages/Auth";
import Account from "@/pages/Account";
import SamplePlan from "@/pages/SamplePlan";
import Nutrition from "@/pages/Nutrition";
import Navbar from "@/components/layout/Navbar";
import { NeonAuthUIProvider } from "@neondatabase/neon-js/auth/react";
import { authClient } from "@/lib/auth";
import AuthProvider from "@/context/AuthContext";
import Footer from "@/components/layout/Footer";

// The router keeps the old scroll position, so e.g. generating a plan from the bottom of the questionnaire
// would open the finished plan already scrolled down.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function App() {
  return (
    <NeonAuthUIProvider authClient={authClient} defaultTheme="dark">
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route index element={<Home />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/sample" element={<SamplePlan />} />
                <Route path="/nutrition" element={<Nutrition />} />
                <Route path="/auth/:pathname" element={<Auth />} />
                <Route path="/account/:pathname" element={<Account />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </NeonAuthUIProvider>
  );
}

export default App;
