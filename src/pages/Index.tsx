import { DocumentForm } from "@/components/DocumentForm";
import { FileText } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background">
      <div className="container max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-accent rounded-2xl mb-6">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Что мы добавляем в портал?
          </h1>
          <p className="text-muted-foreground text-lg">
            Заполните форму. Все поля обязательны.
          </p>
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
