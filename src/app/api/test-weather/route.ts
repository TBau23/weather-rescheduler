import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = searchParams.get('lat') || '40.7128'; // Default to NYC
  const lon = searchParams.get('lon') || '-74.0060';

  const apiKey = process.env.OPENWEATHERMAP_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'OPENWEATHERMAP_API_KEY not configured'
    }, { status: 500 });
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`;
    const response = await axios.get(url);
    
    const data = response.data;
    
    return NextResponse.json({
      success: true,
      message: 'Weather API is working!',
      location: data.name,
      conditions: {
        temperature: `${data.main.temp}°F`,
        description: data.weather[0].description,
        windSpeed: `${data.wind.speed} mph`,
        visibility: `${(data.visibility / 1609.34).toFixed(1)} miles`,
        humidity: `${data.main.humidity}%`
      },
      raw: data
    });
  } catch (error) {
    console.error('Weather API test error:', error);
    if (axios.isAxiosError(error)) {
      return NextResponse.json({
        success: false,
        error: error.response?.data?.message || error.message,
        status: error.response?.status
      }, { status: error.response?.status || 500 });
    }
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

