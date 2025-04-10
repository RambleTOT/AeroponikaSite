import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import './DeepSeekForm.css';
import Tesseract from 'tesseract.js';


const formatResponse = (text) => {
    // Форматирование математических выражений и текста
    let formattedText = text
      // Блоки математики \[ \]
      .replace(/\\\[(.*?)\\\]/gs, '<div class="math-block">$1</div>')
      // Инлайн математика \( \)
      .replace(/\\\((.*?)\\\)/g, '<span class="math-inline">$1</span>')
      // Дроби \frac{}{}
      .replace(/\\frac\{(.*?)\}\{(.*?)\}/g, '<span class="math-frac"><span class="numerator">$1</span><span class="denominator">$2</span></span>')
      // Жирный текст ** **
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Курсив \text{ }
      .replace(/\\text\{(.*?)\}/g, '<span class="text-style">$1</span>')
      // Нумерованные списки
      .replace(/(\d+\.)\s/g, '<span class="list-number">$1</span> ')
      // Маркированные списки
      .replace(/\n-\s/g, '<br/>• ')
      // Переносы строк
      .replace(/\n/g, '<br/>');
  
    return formattedText;
  };

const DeepSeekForm = () => {
  const [input, setInput] = useState('');
  const [responses, setResponses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  
  const fileInputRef = useRef(null);
  const dropAreaRef = useRef(null);

  const API_KEY = process.env.REACT_APP_DEEPSEEK_API_KEY;
  const API_URL = process.env.REACT_APP_DEEPSEEK_API_URL;

  const systemPrompt = `Ты эксперт...`; // Ваш существующий промпт

  // Функция для форматирования ответа с LaTeX-подобным синтаксисом
  const formatResponse = (text) => {
    return text
      .replace(/\\\[/g, '\n$$') // Заменяем \[ на $$ для блоков
      .replace(/\\\]/g, '$$\n')  // Заменяем \] на $$ для блоков
      .replace(/\\\(/g, '$')     // Заменяем \( на $ для inline
      .replace(/\\\)/g, '$')     // Заменяем \) на $ для inline
      .replace(/\\boxed{(.*?)}/g, '**$1**') // Форматируем boxed
      .replace(/\*\*(.*?)\*\*/g, '**$1**')  // Сохраняем жирный текст
      .replace(/\n- /g, '\n• ');            // Заменяем маркированные списки
  };

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);
    recognizeText(file);
  }, [file]);

  const recognizeText = async (imageFile) => {
    setIsOcrLoading(true);
    setOcrProgress(0);
    setInput(''); // Очищаем предыдущий текст при загрузке нового изображения

    try {
      const { data: { text } } = await Tesseract.recognize(
        imageFile,
        'rus+eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round(m.progress * 100));
            }
          }
        }
      );

      // Убираем "Текст с изображения" и лишние пробелы
      const cleanedText = text.replace(/\s+/g, ' ').trim();
      setInput(cleanedText);
      
    } catch (error) {
      console.error('Ошибка распознавания текста:', error);
      setInput('[Ошибка распознавания текста]');
    } finally {
      setIsOcrLoading(false);
      setOcrProgress(0);
    }
  };

  // Обработчики drag-and-drop остаются без изменений
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.match('image.*')) {
      if (files[0].size > 5 * 1024 * 1024) {
        alert('Изображение должно быть меньше 5MB');
        return;
      }
      setFile(files[0]);
    }
  }, []);

  useEffect(() => {
    const dropArea = dropAreaRef.current;
    
    if (dropArea) {
      dropArea.addEventListener('dragenter', handleDragEnter);
      dropArea.addEventListener('dragleave', handleDragLeave);
      dropArea.addEventListener('dragover', handleDragOver);
      dropArea.addEventListener('drop', handleDrop);
      
      return () => {
        dropArea.removeEventListener('dragenter', handleDragEnter);
        dropArea.removeEventListener('dragleave', handleDragLeave);
        dropArea.removeEventListener('dragover', handleDragOver);
        dropArea.removeEventListener('drop', handleDrop);
      };
    }
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        const pastedFile = new File([blob], 'pasted-image.png', { type: 'image/png' });
        if (pastedFile.size > 5 * 1024 * 1024) {
          alert('Изображение должно быть меньше 5MB');
          return;
        }
        setFile(pastedFile);
        break;
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    const userQuestion = input;
    setInput(''); // Очищаем поле ввода после отправки

    // Добавляем новый вопрос в начало массива
    const newResponses = [{ 
      question: userQuestion, 
      answer: "Обработка запроса..." 
    }, ...responses];
    setResponses(newResponses);

    try {
      const response = await axios.post(`${API_URL}/chat/completions`, {
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userQuestion
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        }
      });

      const answer = response.data.choices?.[0]?.message?.content || "Не удалось получить ответ.";
      const formattedAnswer = formatResponse(answer);
      
      setResponses(prev => [
        { ...prev[0], answer: formattedAnswer },
        ...prev.slice(1)
      ]);

    } catch (error) {
      console.error('Ошибка:', error);
      setResponses(prev => [
        { ...prev[0], answer: `Ошибка: ${error.response?.data?.error?.message || error.message}` },
        ...prev.slice(1)
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.type.match('image.*')) {
        alert('Пожалуйста, выберите изображение');
        return;
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        alert('Изображение должно быть меньше 5MB');
        return;
      }
      setFile(selectedFile);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="deepseek-form">
      <h3>Задайте вопрос про аэропонику</h3>
      <p>Наш AI-ассистент ответит на ваши вопросы о выращивании растений без почвы</p>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Введите ваш вопрос или загрузите изображение..."
            rows="4"
            disabled={isOcrLoading}
          />
        </div>
        
        <div className="file-upload-section">
          <div 
            className={`paste-area ${isDragging ? 'dragging' : ''}`}
            ref={dropAreaRef}
            onPaste={handlePaste}
            onClick={triggerFileInput}
          >
            {preview ? (
              <>
                <img src={preview} alt="Предпросмотр" className="image-preview" />
                {isOcrLoading && (
                  <div className="ocr-progress-overlay">
                    <div className="ocr-progress-bar" style={{ width: `${ocrProgress}%` }}></div>
                    <span>Распознавание текста: {ocrProgress}%</span>
                  </div>
                )}
              </>
            ) : (
              <div className="upload-instructions">
                <p>Перетащите сюда изображение, вставьте из буфера обмена (Ctrl+V)</p>
                <p>Или нажмите для выбора файла</p>
                {isDragging && <div className="drag-overlay">Отпустите для загрузки</div>}
              </div>
            )}
          </div>
          
          <input 
            id="file-upload" 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange} 
            accept="image/*"
            style={{ display: 'none' }}
          />
          
          {file && (
            <div className="file-info">
              <span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
              <button 
                type="button" 
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                }}
                className="remove-file"
                disabled={isOcrLoading}
              >
                ×
              </button>
            </div>
          )}
        </div>
        
        {isOcrLoading && (
          <div className="ocr-progress">
            <div className="ocr-progress-bar" style={{ width: `${ocrProgress}%` }}></div>
            <span>Распознавание текста: {ocrProgress}%</span>
          </div>
        )}
        
        <button 
          type="submit" 
          disabled={isLoading || isOcrLoading || !input.trim()}
        >
          {isLoading ? 'Отправка...' : 'Отправить запрос'}
        </button>
      </form>
      
      {responses.length > 0 && (
        <div className="responses">
          <h4>Ответы:</h4>
          {responses.map((item, index) => (
            <div key={index} className="response-item">
              <div className="question">
                <strong>Вопрос:</strong> {item.question}
              </div>
              <div className="answer">
                <strong>Ответ:</strong> 
                <div dangerouslySetInnerHTML={{ __html: item.answer.replace(/\n/g, '<br/>').replace(/\$\$(.*?)\$\$/g, '<div class="math-block">$1</div>').replace(/\$(.*?)\$/g, '<span class="math-inline">$1</span>') }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DeepSeekForm;