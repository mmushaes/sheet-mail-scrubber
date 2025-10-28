import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Mail } from "lucide-react";
import { toast } from "sonner";

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Signed in successfully!");
          navigate("/");
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          }
        });
        
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Account created successfully!");
          navigate("/");
        }
      }
    } catch (error: any) {
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
            <form onSubmit={handleAuth} className="space-y-6">
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

              {/* Email Input */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  minLength={6}
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12"
                size="lg"
              >
                {isLoading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
              </Button>

              {/* Info Text */}
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  By continuing, you agree to our Terms of Service and Privacy Policy
                </p>
              </div>
            </form>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Mail className="w-4 h-4" />
            Secure email authentication
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
