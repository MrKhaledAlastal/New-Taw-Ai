'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function TestImagePage() {
  const [image, setImage] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!image) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/test-image-processing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: image,
          question,
        }),
      });
      
      const data = await res.json();
      setResponse(data.answer || data.error);
    } catch (error) {
      console.error('Error:', error);
      setResponse('Error processing image');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Test Image Processing</h1>
      
      <div className="mb-4">
        <input type="file" accept="image/*" onChange={handleFileChange} />
      </div>
      
      {image && (
        <div className="mb-4">
          <img src={image} alt="Preview" className="max-w-xs max-h-40" />
        </div>
      )}
      
      <div className="mb-4">
        <Textarea
          placeholder="Ask a question about the image"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </div>
      
      <Button onClick={handleSubmit} disabled={!image || loading}>
        {loading ? 'Processing...' : 'Submit'}
      </Button>
      
      {response && (
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <h2 className="font-bold mb-2">Response:</h2>
          <p>{response}</p>
        </div>
      )}
    </div>
  );
}