import {judgeReadResponse} from '@/lib/judge-read';
import type {NextRequest} from 'next/server';
export const dynamic='force-dynamic';
export const maxDuration=120;
export function GET(req:NextRequest){return judgeReadResponse(req);}

// Provisioning is an owner-only database operation, never a public BFF POST.
export function POST(){return Response.json({message:'Judge mutations disabled'},{status:403});}
