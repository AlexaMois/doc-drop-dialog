import { DocumentForm } from "@/components/DocumentForm";
import logo from "@/assets/logo.jpg";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background">
      <div className="container max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <img src={logo} alt="Логотип" className="h-16 w-16 rounded-2xl mb-6 mx-auto" />
        </div>

        {/* Form Card */}
        <div className="bg-card rounded-2xl shadow-lg p-6 md:p-8 border border-border/50">
          <DocumentForm />
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-8">
          Система управления документами АТС
        </p>
      </div>
    </div>
  );
};

export default Index;
