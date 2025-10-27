import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, Mail } from "lucide-react";
import { toast } from "sonner";

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    checkUser();
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) {
        console.error('OAuth error:', error);
        toast.error(error.message || 'Failed to sign in with Google');
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="overflow-hidden border-primary/20 shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-primary-foreground mb-2">
              Email Verification Tool
            </h1>
            <p className="text-sm text-primary-foreground/90">
              Sign in to start verifying emails
            </p>
          </div>

          {/* Sliding Tab Controls */}
          <div className="relative bg-secondary/30 p-1">
            <div className="grid grid-cols-2 gap-1 relative">
              <button
                onClick={() => setIsLogin(true)}
                className={`relative z-10 py-3 text-sm font-medium transition-colors ${
                  isLogin ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`relative z-10 py-3 text-sm font-medium transition-colors ${
                  !isLogin ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Signup
              </button>
              {/* Slider Tab */}
              <div
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-background rounded-md shadow-sm transition-transform duration-300 ${
                  isLogin ? "translate-x-1" : "translate-x-[calc(100%+4px)]"
                }`}
              />
            </div>
          </div>

          {/* Form Content */}
          <div className="p-8">
            <div className="space-y-6">
              {/* Title */}
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {isLogin ? "Welcome Back" : "Create Account"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isLogin
                    ? "Sign in to continue to your account"
                    : "Sign up to get started with email verification"}
                </p>
              </div>

              {/* Google Sign In Button */}
              <Button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full h-12 bg-background hover:bg-secondary border-2 border-input text-foreground font-medium shadow-sm"
                size="lg"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {isLoading ? (
                  "Loading..."
                ) : (
                  `${isLogin ? "Sign in" : "Sign up"} with Google`
                )}
              </Button>

              {/* Info Text */}
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  By continuing, you agree to our Terms of Service and Privacy Policy
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Mail className="w-4 h-4" />
            Secure authentication powered by Google
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
