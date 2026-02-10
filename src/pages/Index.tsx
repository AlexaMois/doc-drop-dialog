import { useState } from "react";
import { DocumentForm } from "@/components/DocumentForm";
import logo from "@/assets/logo.jpg";

const Index = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background">
      <div className="container max-w-2xl mx-auto px-4 py-12">
        {/* Header - hidden on success screen */}
        {!isSubmitted && (
          <div className="text-center mb-10">
            <img src={logo} alt="Логотип" className="h-16 w-16 rounded-2xl mb-6 mx-auto" />
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              Что мы добавляем в портал?
            </h1>
            <p className="text-muted-foreground text-lg">
              Заполните форму. Все поля обязательны.
            </p>
          </div>
        )}

        {/* Form Card */}
        <div className="bg-card rounded-2xl shadow-lg p-6 md:p-8 border border-border/50">
          <DocumentForm onSubmittedChange={setIsSubmitted} />
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
