"""
Document Service - Extract text from uploaded documents (PDF, TXT, etc.).
"""

import io
from typing import Union
from pypdf import PdfReader


class DocumentService:
    """Service for extracting text from documents."""
    
    async def extract_text(self, file_content: bytes, filename: str) -> str:
        """
        Extract text from uploaded document.
        
        Args:
            file_content: Binary content of the uploaded file
            filename: Name of the uploaded file
            
        Returns:
            Extracted text as string
        """
        file_extension = filename.lower().split('.')[-1]
        
        if file_extension == 'pdf':
            return await self._extract_from_pdf(file_content)
        elif file_extension in ['txt', 'text']:
            return await self._extract_from_text(file_content)
        else:
            raise ValueError(f"Unsupported file format: {file_extension}. Supported formats: pdf, txt")
    
    async def _extract_from_pdf(self, file_content: bytes) -> str:
        """Extract text from PDF file."""
        try:
            pdf_file = io.BytesIO(file_content)
            reader = PdfReader(pdf_file)
            
            text_parts = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)
            
            extracted_text = "\n\n".join(text_parts)
            
            if not extracted_text.strip():
                raise ValueError("No text could be extracted from the PDF. The file may be scanned or image-based.")
            
            return extracted_text
            
        except Exception as e:
            raise ValueError(f"Error extracting text from PDF: {str(e)}")
    
    async def _extract_from_text(self, file_content: bytes) -> str:
        """Extract text from plain text file."""
        try:
            # Try UTF-8 first, fall back to latin-1
            try:
                text = file_content.decode('utf-8')
            except UnicodeDecodeError:
                text = file_content.decode('latin-1')
            
            if not text.strip():
                raise ValueError("The text file appears to be empty.")
            
            return text
            
        except Exception as e:
            raise ValueError(f"Error reading text file: {str(e)}")
