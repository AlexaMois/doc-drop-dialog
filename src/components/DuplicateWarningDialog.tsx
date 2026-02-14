import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { DuplicateRecord } from "@/hooks/useBpiumCatalogs";

interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateRecord[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function DuplicateWarningDialog({
  open,
  onOpenChange,
  duplicates,
  onConfirm,
  onCancel,
}: DuplicateWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Документ с таким названием уже существует</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>Найдены похожие записи в системе:</p>
              <div className="space-y-2">
                {duplicates.map((dup) => (
                  <div
                    key={dup.id}
                    className="rounded-md border p-3 text-sm space-y-1"
                  >
                    <p className="font-medium text-foreground">{dup.title}</p>
                    {dup.responsiblePerson && (
                      <p className="text-muted-foreground">
                        Внёс(ла): {dup.responsiblePerson}
                      </p>
                    )}
                    {dup.submissionDate && (
                      <p className="text-muted-foreground">
                        Дата: {new Date(dup.submissionDate).toLocaleDateString("ru-RU")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <p>Вы уверены, что хотите отправить документ повторно?</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Отменить</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Отправить всё равно
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
