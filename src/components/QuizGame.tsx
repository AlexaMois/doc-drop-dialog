import * as React from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sparkles, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const quizData = [
  {
    question: 'Используешь страховочные ___?',
    answer: 'стропы',
    options: ['стропы', 'ремни', 'верёвки']
  },
  {
    question: 'Применяешь ___?',
    answer: 'СИЗ',
    options: ['СИЗ', 'перчатки', 'каску']
  },
  {
    question: 'Можешь сам заменить ___?',
    answer: 'предохранитель',
    options: ['предохранитель', 'лампочку', 'колесо']
  },
  {
    question: 'Используешь домкраты и страховочные ___?',
    answer: 'стропы',
    options: ['стропы', 'опоры', 'балки']
  },
  {
    question: 'Убрал инструмент на ___?',
    answer: 'место',
    options: ['место', 'стол', 'ящик']
  },
  {
    question: 'Остановился?',
    answer: 'Отдых тоже часть пути!',
    options: [
      'Отдых тоже часть пути!',
      'Нужно торопиться!',
      'Поехали дальше!'
    ]
  },
  {
    question: 'Пристегнулся?',
    answer: 'Пристегни всех пассажиров!',
    options: [
      'Пристегни всех пассажиров!',
      'Проверь свой ремень!',
      'Проверь документы!'
    ]
  },
  {
    question: 'Не отвлекаешься на ___?',
    answer: 'гаджеты',
    options: ['гаджеты', 'еду', 'рекламу']
  },
  {
    question: 'Не ешь на рабочем ___?',
    answer: 'месте',
    options: ['месте', 'кресле', 'полу']
  },
  {
    question: 'Никуда не ___?',
    answer: 'спешишь',
    options: ['спешишь', 'едешь', 'поворачиваешь']
  },
  {
    question: 'Не любишь ___?',
    answer: 'очереди',
    options: ['очереди', 'ожидание', 'звонки']
  },
  {
    question: 'Двигаешься по верному ___?',
    answer: 'маршруту',
    options: ['маршруту', 'курсу', 'графику']
  },
  {
    question: 'Смотришь в ___?',
    answer: 'зеркала',
    options: ['зеркала', 'окна', 'приборы']
  }
];

interface QuizGameProps {
  onCorrectAnswer: (isCorrect: boolean) => void;
}

export function QuizGame({ onCorrectAnswer }: QuizGameProps) {
  const [quiz] = React.useState(() => {
    const randomIndex = Math.floor(Math.random() * quizData.length);
    return quizData[randomIndex];
  });
  
  const [selectedOption, setSelectedOption] = React.useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = React.useState(false);
  const [isCorrect, setIsCorrect] = React.useState(false);

  const handleOptionChange = (value: string) => {
    setSelectedOption(value);
    setHasAnswered(true);
    
    const correct = value === quiz.answer;
    setIsCorrect(correct);
    onCorrectAnswer(correct);
  };

  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <Label className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        Мини-викторина
      </Label>
      
      <div className="bg-accent/50 rounded-lg p-4 space-y-4">
        <p className="font-medium text-foreground">
          {quiz.question}
        </p>
        
        <RadioGroup
          value={selectedOption || ""}
          onValueChange={handleOptionChange}
          className="space-y-2"
        >
          {quiz.options.map((option, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center space-x-3 rounded-lg border p-3 transition-colors cursor-pointer",
                selectedOption === option && isCorrect
                  ? "border-primary bg-primary/10"
                  : selectedOption === option && !isCorrect
                  ? "border-destructive bg-destructive/10"
                  : "border-border bg-card hover:bg-accent"
              )}
            >
              <RadioGroupItem value={option} id={`option-${index}`} />
              <Label 
                htmlFor={`option-${index}`} 
                className="flex-1 cursor-pointer font-normal"
              >
                {option}
              </Label>
            </div>
          ))}
        </RadioGroup>
        
        {hasAnswered && (
          <div className={cn(
            "flex items-center gap-2 text-sm font-medium",
            isCorrect ? "text-primary" : "text-destructive"
          )}>
            {isCorrect ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Верно! Можно отправлять.
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" />
                Попробуй ещё раз
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
