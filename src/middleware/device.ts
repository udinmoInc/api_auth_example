import { Request, Response, NextFunction } from 'express';
import useragent from 'express-useragent';

export const deviceExtractor = (req: Request, _res: Response, next: NextFunction) => {
  const userAgentString = req.headers['user-agent'] || '';
  const parsedUa = useragent.parse(userAgentString);
  
  // Resolve client IP (supporting proxies / Load balancers like Cloudflare or Nginx)
  const forwardedFor = req.headers['x-forwarded-for'];
  let ipAddress = '127.0.0.1';
  
  if (forwardedFor) {
    ipAddress = Array.isArray(forwardedFor) 
      ? forwardedFor[0] 
      : forwardedFor.split(',')[0].trim();
  } else {
    ipAddress = req.socket.remoteAddress || req.ip || '127.0.0.1';
  }

  // Map device type
  let deviceType = 'Desktop';
  if (parsedUa.isMobile) {
    deviceType = 'Mobile';
  } else if (parsedUa.isTablet) {
    deviceType = 'Tablet';
  } else if (parsedUa.isBot) {
    deviceType = 'Bot';
  }

  req.deviceMetadata = {
    ipAddress,
    userAgent: userAgentString,
    device: deviceType,
    os: parsedUa.os || 'Unknown',
    browser: parsedUa.browser || 'Unknown',
  };

  next();
};

export default deviceExtractor;
